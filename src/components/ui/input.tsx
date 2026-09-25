import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-2xl hairline border-black/10 bg-white/60 dark:border-white/12 dark:bg-white/8 px-4 text-base shadow-[inset_0_1px_0_rgb(255_255_255/0.8)] dark:shadow-none transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-foreground/40 focus-visible:ring-4 focus-visible:ring-black/[0.04] dark:focus-visible:ring-white/10",
        "aria-invalid:border-foreground/60",
        className
      )}
      {...props}
    />
  )
}

export { Input }
