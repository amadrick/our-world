"use client"

import { AlertCircle, AlertTriangle, CheckCircle, Info, Loader } from "react-feather"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CheckCircle size={16} />,
        info: <Info size={16} />,
        warning: <AlertTriangle size={16} />,
        error: <AlertCircle size={16} />,
        loading: <Loader size={16} className="animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-[22px] !border-[0.5px] !border-black/10 !bg-white/70 !shadow-float !backdrop-blur-xl !backdrop-saturate-[1.9] !text-base !font-normal",
          actionButton: "!rounded-full !bg-[rgb(22_22_26/0.85)] !text-sm !font-medium",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "20px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
