import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.tsx"
import { AuthProvider } from "@/contexts/AuthContext"
import { XPProvider } from "@/contexts/XPContext"
import { PortfolioProvider } from "@/contexts/PortfolioContext"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <XPProvider>
          <PortfolioProvider>
            <App />
          </PortfolioProvider>
        </XPProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
