import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY não configurada. A geração de avatar requer uma chave OpenAI válida com créditos para DALL-E.");

    // Auth check
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const prompt = body.prompt;
    const photo_url = body.photo_url;

    if (!prompt && !photo_url) throw new Error("prompt or photo_url is required");

    console.log("Generating avatar for user:", user.id);

    let imageBase64: string;
    let imageMimeType = "png";

    if (photo_url) {
      // Photo-based: Use GPT-4o to describe the person, then DALL-E 3 to generate chibi
      console.log("Photo-based generation: analyzing photo with GPT-4o-mini...");

      const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this person's photo and provide a detailed physical description. Include: 
- Hair color, style, length
- Skin tone
- Eye color
- Facial features (shape, distinctive features)
- Any glasses, facial hair, or accessories
- Estimated age range
- Gender presentation
Be very specific and detailed. Only describe physical appearance, nothing else.`,
                },
                {
                  type: "image_url",
                  image_url: { url: photo_url },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      });

      if (!visionResponse.ok) {
        const errText = await visionResponse.text();
        console.error("Vision API error:", visionResponse.status, errText);
        throw new Error("Failed to analyze photo");
      }

      const visionData = await visionResponse.json();
      const description = visionData.choices?.[0]?.message?.content || "";
      console.log("Photo description:", description.slice(0, 200));

      // Generate chibi avatar with DALL-E 3 based on description
      const dallePrompt = `Create a 3D chibi vinyl toy character figure based on this person's description:
${description}

Style requirements:
- Chibi proportions: oversized head (about 1/2 of total height), small rounded body
- Matte plastic toy appearance, like a collectible designer vinyl figure
- Soft studio lighting on a pure white background
- No shadows, no floor reflection
- Outfit: elegant navy blue business suit with subtle details
- Face: cute chibi style with expressive large eyes and a warm friendly smile
- Full body visible, centered composition
- High detail, clean render, professional product photography style
- Square image on solid white background`;

      const dalleResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: dallePrompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
          quality: "standard",
        }),
      });

      if (!dalleResponse.ok) {
        const errText = await dalleResponse.text();
        console.error("DALL-E error:", dalleResponse.status, errText);
        if (dalleResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns minutos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (dalleResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos OpenAI insuficientes." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("DALL-E generation failed: " + errText);
      }

      const dalleData = await dalleResponse.json();
      imageBase64 = dalleData.data?.[0]?.b64_json;
      if (!imageBase64) throw new Error("DALL-E did not return an image");

    } else {
      // Prompt-based generation with DALL-E 3
      console.log("Prompt-based generation with DALL-E 3...");

      const dalleResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
          quality: "standard",
        }),
      });

      if (!dalleResponse.ok) {
        const errText = await dalleResponse.text();
        console.error("DALL-E error:", dalleResponse.status, errText);
        if (dalleResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns minutos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("DALL-E generation failed: " + errText);
      }

      const dalleData = await dalleResponse.json();
      imageBase64 = dalleData.data?.[0]?.b64_json;
      if (!imageBase64) throw new Error("DALL-E did not return an image");
    }

    // Decode base64 and upload
    const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const filePath = `${user.id}/avatar-gamificado.png`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(filePath, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error("Failed to save avatar: " + uploadError.message);
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        avatar_url: avatarUrl,
        avatar_preview_url: avatarUrl,
        avatar_gamificado_url: avatarUrl,
        avatar_updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      throw new Error("Failed to update profile");
    }

    console.log("Avatar generated successfully for user:", user.id);

    return new Response(JSON.stringify({ url: avatarUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-avatar error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
