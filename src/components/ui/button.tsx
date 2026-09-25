import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "pressable focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg text-base font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-ink-hover",
        destructive: "bg-ink text-white hover:bg-ink-hover",
        outline: "border border-ink bg-surface text-ink hover:bg-secondary",
        secondary: "border border-border bg-surface text-ink hover:border-ink",
        ghost: "text-ink hover:bg-black/[0.05] active:bg-black/[0.08]",
        link: "text-ink underline underline-offset-4",
      },
      size: {
        default: "h-12 px-5",
        xs: "h-8 gap-1.5 rounded-full px-3 text-sm",
        sm: "h-10 gap-1.5 rounded-md px-4 text-sm",
        lg: "h-14 px-6",
        icon: "size-12 rounded-full",
        "icon-xs": "size-8 rounded-full",
        "icon-sm": "size-10 rounded-full",
        "icon-lg": "size-14 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
