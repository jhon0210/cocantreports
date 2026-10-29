import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="top-right"
    richColors
    closeButton
    className="toaster group"
    toastOptions={{ classNames: { toast: 'font-sans' } }}
    {...props}
  />
)

export { Toaster }
