import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-2xl hairline border-black/10 bg-white/60 dark:border-white/12 dark:bg-white/8 px-4 py-3 text-base shadow-[inset_0_1px_0_rgb(255_255_255/0.8)] dark:shadow-none transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-foreground/40 focus-visible:ring-4 focus-visible:ring-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-foreground/60",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
