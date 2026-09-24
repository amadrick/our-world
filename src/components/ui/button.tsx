import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full text-base font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-4 focus-visible:ring-black/10 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        destructive: "bg-primary text-primary-foreground hover:bg-primary/85",
        outline: "hairline border-input bg-background hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-black/[0.07]",
        ghost: "hover:bg-secondary",
        link: "text-primary underline underline-offset-4",
      },
      size: {
        default: "h-11 px-5",
        xs: "h-8 gap-1.5 px-3 text-sm",
        sm: "h-9 gap-1.5 px-4 text-sm",
        lg: "h-12 px-6",
        icon: "size-11",
        "icon-xs": "size-8",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
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
