import { Navigate, Route, Routes } from "react-router-dom"
import { RootLayout } from "@/layouts/RootLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { ScreenerPage } from "@/pages/ScreenerPage"
import { StockPage } from "@/pages/StockPage"
import { ComparePage } from "@/pages/ComparePage"
import { MethodologiePage } from "@/pages/MethodologiePage"
import { PortfolioPage } from "@/pages/PortfolioPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { LeaderboardPage } from "@/pages/LeaderboardPage"
import { DataFreshnessPage } from "@/pages/DataFreshnessPage"
import { PicksPage } from "@/pages/PicksPage"
import { PicksDetailPage } from "@/pages/PicksDetailPage"
import { ProtectedRoute } from "@/components/ProtectedRoute"

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/screener" element={<ScreenerPage />} />
        <Route path="/stock/:ticker" element={<StockPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/methodologie" element={<MethodologiePage />} />
        <Route path="/data-freshness" element={<DataFreshnessPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/picks" element={<PicksPage />} />
        <Route path="/picks/:id" element={<PicksDetailPage />} />
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <PortfolioPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/screener" replace />} />
      </Route>
    </Routes>
  )
}

export default App
