// This page is now integrated into AcademiaTrilhaPage (2-column layout)
// Redirects to the trilha page instead
import { useParams, Navigate } from "react-router-dom";

export default function AcademiaAulaPage() {
  const { aulaId } = useParams<{ aulaId: string }>();
  // Redirect to academia - the aula player is now inside the trilha page
  return <Navigate to="/academia" replace />;
}
