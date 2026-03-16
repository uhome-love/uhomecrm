UPDATE whatsapp_campaign_sends SET status_envio = 'pending', error_message = NULL, response_payload = NULL WHERE batch_id = '71a36b18-2971-4f94-a4f9-033f4ce33593' AND status_envio = 'failed';

UPDATE whatsapp_campaign_batches SET template_params = (template_params::jsonb - 'button_url')::json, status = 'draft' WHERE id = '71a36b18-2971-4f94-a4f9-033f4ce33593';