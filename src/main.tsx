import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.tsx"
import { AuthProvider } from "@/contexts/AuthContext"
import { XPProvider } from "@/contexts/XPContext"
import { PortfolioProvider } from "@/contexts/PortfolioContext"
import { ErrorBoundary } from "@/components/ErrorBoundary"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <XPProvider>
            <PortfolioProvider>
              <App />
            </PortfolioProvider>
          </XPProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
