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
            "!rounded-2xl !border !border-hairline !bg-surface !shadow-raised !text-base !font-normal !text-ink",
          title: "!font-semibold",
          description: "!text-sm !text-muted-foreground",
          actionButton: "!h-9 !rounded-full !bg-ink !px-4 !text-sm !font-semibold",
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
