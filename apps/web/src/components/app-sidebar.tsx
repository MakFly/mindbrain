import * as React from "react"
import { BrainIcon, DatabaseIcon, FileTextIcon, NetworkIcon, SettingsIcon } from "lucide-react"
import { NavLink } from "react-router-dom"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onSettingsOpen: () => void
  connected: boolean
}

const navItems = [
  { title: "Notes", to: "/", icon: FileTextIcon, end: true },
  { title: "Graph", to: "/graph", icon: NetworkIcon, end: false },
  { title: "Sources", to: "/sources", icon: DatabaseIcon, end: false },
]

export function AppSidebar({ onSettingsOpen, connected, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/">
                <BrainIcon className="h-5 w-5" />
                <span className="text-base font-semibold">Mindbrain</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-2 py-1.5 rounded-md text-sm w-full transition-colors ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 py-1.5">
              {connected ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 text-xs bg-green-500/10 text-green-700 border-green-500/20 w-full justify-center"
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  Live
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1.5 text-xs bg-orange-500/10 text-orange-700 border-orange-500/20 w-full justify-center"
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                  Reconnecting...
                </Badge>
              )}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
              onClick={onSettingsOpen}
            >
              <SettingsIcon className="h-4 w-4" />
              <span>Settings</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
