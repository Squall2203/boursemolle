import { Navigate, Route, Routes } from "react-router-dom"
import { RootLayout } from "@/layouts/RootLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { ScreenerPage } from "@/pages/ScreenerPage"
import { StockPage } from "@/pages/StockPage"
import { ComparePage } from "@/pages/ComparePage"
import { MethodologiePage } from "@/pages/MethodologiePage"

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/screener" element={<ScreenerPage />} />
        <Route path="/stock/:ticker" element={<StockPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/methodologie" element={<MethodologiePage />} />
        <Route path="*" element={<Navigate to="/screener" replace />} />
      </Route>
    </Routes>
  )
}

export default App
