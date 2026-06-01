import * as React from "react"
import { cn } from "@/lib/utils"

const Alert = React.forwardRef(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(
      "relative w-full rounded-lg border p-4",
      {
        "border-gray-200 bg-white text-gray-900": variant === "default",
        "border-red-200 bg-red-50 text-red-900": variant === "destructive",
        "border-green-200 bg-green-50 text-green-900": variant === "success",
        "border-yellow-200 bg-yellow-50 text-yellow-900": variant === "warning",
      },
      className
    )}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription }
