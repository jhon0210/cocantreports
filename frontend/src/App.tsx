import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { RequireRole } from '@/components/layout/RequireRole'
import { ACCESS } from '@/lib/permissions'
import { ConsultarReportePage } from '@/pages/ConsultarReportePage'
import { CrearReportePage } from '@/pages/CrearReportePage'
import { EcaPage } from '@/pages/EcaPage'
import { LoginPage } from '@/pages/LoginPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PrefacturarPage } from '@/pages/PrefacturarPage'
import { BalanceMasasPage } from '@/pages/BalanceMasasPage'
import { RecuperadorPage } from '@/pages/RecuperadorPage'
import { UsuariosPage } from '@/pages/UsuariosPage'
import { bootstrapSession } from '@/services/auth.service'

export default function App() {
  useEffect(() => {
    void bootstrapSession()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />

          <Route element={<RequireRole allowed={ACCESS.crearReporte} />}>
            <Route path="/reportes/crear" element={<CrearReportePage />} />
          </Route>
          <Route element={<RequireRole allowed={ACCESS.consultarReporte} />}>
            <Route path="/reportes/consultar" element={<ConsultarReportePage />} />
          </Route>
          <Route element={<RequireRole allowed={ACCESS.prefacturar} />}>
            <Route path="/reportes/prefacturar" element={<PrefacturarPage />} />
          </Route>
          <Route element={<RequireRole allowed={ACCESS.balanceMasas} />}>
            <Route path="/balance-masas" element={<BalanceMasasPage />} />
          </Route>

          <Route element={<RequireRole allowed={ACCESS.caracterizar} />}>
            <Route path="/caracterizar" element={<Navigate to="/caracterizar/recuperador" replace />} />
            <Route path="/caracterizar/recuperador" element={<RecuperadorPage />} />
            <Route path="/caracterizar/eca" element={<EcaPage />} />
          </Route>

          <Route element={<RequireRole allowed={ACCESS.usuarios} />}>
            <Route path="/usuarios" element={<UsuariosPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
