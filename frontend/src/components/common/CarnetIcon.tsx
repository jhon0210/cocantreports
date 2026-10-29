import type { SVGProps } from 'react'

/**
 * Carnet de identificación: tarjeta con marco de foto y busto a la izquierda, y líneas de texto a la derecha.
 * Hereda el color (currentColor) y el tamaño (`className="size-5"`) como los iconos de lucide, con trazo fino.
 */
export function CarnetIcon({ strokeWidth = 1.25, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="1.5" y="4.5" width="21" height="15" rx="2.5" />
      <rect x="4" y="7" width="7" height="10" rx="1" />
      <circle cx="7.5" cy="10.6" r="1.7" />
      <path d="M5.1 16.6v-.2a2.4 2.4 0 0 1 2.4-2.4 2.4 2.4 0 0 1 2.4 2.4v.2" />
      <path d="M13.5 9h6" />
      <path d="M13.5 11.5h6" />
      <rect x="13.5" y="14" width="6" height="2" rx=".5" />
    </svg>
  )
}
