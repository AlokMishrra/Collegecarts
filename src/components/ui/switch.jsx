import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-[34px] w-[60px] sm:h-8 sm:w-[60px] shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-gray-300",
      className
    )}
    {...props}
    ref={ref}>
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-[26px] w-[26px] sm:h-6 sm:w-6 rounded-full bg-white shadow-md ring-0 transition-transform data-[state=checked]:translate-x-[26px] sm:data-[state=checked]:translate-x-[28px] data-[state=unchecked]:translate-x-0"
      )} />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
