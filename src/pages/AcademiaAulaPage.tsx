// This page is now integrated into AcademiaTrilhaPage (2-column layout)
// Redirects to the trilha page instead
import { useMatch, Navigate } from "react-router-dom";

export default function AcademiaAulaPage() {
  const activeSource = useMatch("/academia/aula/:aulaId");
  // Redirect to academia - the aula player is now inside the trilha page
  return activeSource ? <Navigate to="/academia" replace /> : null;
}
