// Layout vacío — solo renderiza el contenido sin navbar ni sidebar
// Para eliminar esta funcionalidad: borrar toda la carpeta app/(stats-feria)/

export default function StatsFeriaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
