"use client";

import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Download,
  Edit,
  Home,
  Info,
  Mail,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Share2,
  Trash2,
  User,
} from "lucide-react";
import * as React from "react";
import { toast } from "@/components/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function DesignSystemPage() {
  const [progress, setProgress] = React.useState(33);
  const [isOpen, setIsOpen] = React.useState(false);
  const [showStatusBar, setShowStatusBar] = React.useState(true);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4 px-4">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-xl tracking-tight">
              Context Design System
            </h1>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" type="button" variant="ghost">
                    <Search className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" type="button" variant="ghost">
                  <Bell className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Mail className="mr-2 h-4 w-4" />
                  <span>New message</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>Event reminder</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" type="button" variant="ghost">
                  <Avatar className="h-8 w-8">
                    <AvatarImage alt="User" src="" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                  <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                  <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">
        <div className="space-y-8">
          {/* Typography Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Typography
            </h2>
            <Card>
              <CardHeader>
                <CardTitle>Text Scales & Weights</CardTitle>
                <CardDescription>
                  Geist Sans family with multiple scales and weights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs">
                    Text XS (0.75rem)
                  </p>
                  <p className="text-sm">Text SM (0.875rem)</p>
                  <p className="text-base">Text Base (1rem)</p>
                  <p className="text-lg">Text LG (1.125rem)</p>
                  <p className="text-xl tracking-tight">Text XL (1.25rem)</p>
                  <p className="font-semibold text-2xl tracking-tight">
                    Text 2XL (1.5rem)
                  </p>
                  <p className="font-semibold text-3xl tracking-tight">
                    Text 3XL (1.875rem)
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="font-normal">Regular Weight (400)</p>
                  <p className="font-medium">Medium Weight (500)</p>
                  <p className="font-semibold">Semibold Weight (600)</p>
                  <p className="font-bold">Bold Weight (700)</p>
                </div>
                <Separator />
                <div className="rounded-md bg-muted p-4">
                  <code className="font-mono text-sm">
                    Code with Geist Mono (monospace)
                  </code>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Color Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Color Tokens
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Background Colors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-md border bg-background" />
                    <span className="text-sm">bg-background</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-md border bg-card" />
                    <span className="text-sm">bg-card</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-md border bg-popover" />
                    <span className="text-sm">bg-popover</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-md border bg-muted" />
                    <span className="text-sm">bg-muted</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Interactive Colors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-md bg-primary" />
                    <span className="text-sm">bg-primary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-md border bg-secondary" />
                    <span className="text-sm">bg-secondary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-md border bg-accent" />
                    <span className="text-sm">bg-accent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-md bg-destructive" />
                    <span className="text-sm">bg-destructive</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Text Colors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-foreground">text-foreground</p>
                  <p className="text-muted-foreground">text-muted-foreground</p>
                  <p className="text-card-foreground">text-card-foreground</p>
                  <p className="text-popover-foreground">
                    text-popover-foreground
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Buttons Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">Buttons</h2>
            <Card>
              <CardHeader>
                <CardTitle>Button Variants</CardTitle>
                <CardDescription>
                  All button variants with different styles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="default">
                    Default
                  </Button>
                  <Button type="button" variant="secondary">
                    Secondary
                  </Button>
                  <Button type="button" variant="outline">
                    Outline
                  </Button>
                  <Button type="button" variant="ghost">
                    Ghost
                  </Button>
                  <Button type="button" variant="link">
                    Link
                  </Button>
                  <Button type="button" variant="destructive">
                    Destructive
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="font-medium text-sm">Button Sizes</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" type="button">
                      Small
                    </Button>
                    <Button size="default" type="button">
                      Default
                    </Button>
                    <Button size="lg" type="button">
                      Large
                    </Button>
                    <Button size="icon" type="button">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="font-medium text-sm">Buttons with Icons</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button">
                      <Mail className="mr-2 h-4 w-4" />
                      Send Email
                    </Button>
                    <Button type="button" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button type="button" variant="secondary">
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="font-medium text-sm">Disabled State</p>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled type="button">
                      Disabled Default
                    </Button>
                    <Button disabled type="button" variant="outline">
                      Disabled Outline
                    </Button>
                    <Button disabled type="button" variant="secondary">
                      Disabled Secondary
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Badges Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">Badges</h2>
            <Card>
              <CardHeader>
                <CardTitle>Badge Variants</CardTitle>
                <CardDescription>Status indicators and labels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Form Elements Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Form Elements
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Inputs & Labels</CardTitle>
                  <CardDescription>
                    Text inputs with proper labeling
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      placeholder="Enter your email"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      placeholder="Enter your password"
                      type="password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disabled">Disabled Input</Label>
                    <Input
                      disabled
                      id="disabled"
                      placeholder="Disabled"
                      type="text"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file">File Input</Label>
                    <Input id="file" type="file" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Textarea & Select</CardTitle>
                  <CardDescription>
                    Multi-line input and dropdown selection
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Type your message here"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="framework">Framework</Label>
                    <Select>
                      <SelectTrigger id="framework">
                        <SelectValue placeholder="Select a framework" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="next">Next.js</SelectItem>
                        <SelectItem value="react">React</SelectItem>
                        <SelectItem value="vue">Vue</SelectItem>
                        <SelectItem value="svelte">Svelte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Progress & Skeleton Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Progress & Loading States
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Progress Bars</CardTitle>
                  <CardDescription>Visual progress indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setProgress(Math.max(0, progress - 10))}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Decrease
                    </Button>
                    <Button
                      onClick={() => setProgress(Math.min(100, progress + 10))}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Increase
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Skeleton Loaders</CardTitle>
                  <CardDescription>Placeholder loading states</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Avatars Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">Avatars</h2>
            <Card>
              <CardHeader>
                <CardTitle>User Avatars</CardTitle>
                <CardDescription>
                  Profile pictures with fallbacks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar>
                    <AvatarImage alt="User 1" src="" />
                    <AvatarFallback>AB</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarImage alt="User 2" src="" />
                    <AvatarFallback>CD</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarImage alt="User 3" src="" />
                    <AvatarFallback>EF</AvatarFallback>
                  </Avatar>
                  <Avatar className="h-12 w-12">
                    <AvatarImage alt="User 4" src="" />
                    <AvatarFallback>GH</AvatarFallback>
                  </Avatar>
                  <Avatar className="h-16 w-16">
                    <AvatarImage alt="User 5" src="" />
                    <AvatarFallback>IJ</AvatarFallback>
                  </Avatar>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Menus & Dialogs Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Menus & Dialogs
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Dropdown Menu</CardTitle>
                  <CardDescription>Context and action menus</CardDescription>
                </CardHeader>
                <CardContent>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline">
                        Open Menu
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={showStatusBar}
                        onCheckedChange={setShowStatusBar}
                      >
                        Status Bar
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                        <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alert Dialog</CardTitle>
                  <CardDescription>Confirmation modals</CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="outline">
                        Open Alert
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete your account and remove your data from our
                          servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction>Continue</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sheet</CardTitle>
                  <CardDescription>Slide-out panels</CardDescription>
                </CardHeader>
                <CardContent>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button type="button" variant="outline">
                        Open Sheet
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Edit Profile</SheetTitle>
                        <SheetDescription>
                          Make changes to your profile here. Click save when
                          you're done.
                        </SheetDescription>
                      </SheetHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input id="name" placeholder="John Doe" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="username">Username</Label>
                          <Input id="username" placeholder="@johndoe" />
                        </div>
                      </div>
                      <SheetFooter>
                        <SheetClose asChild>
                          <Button type="button">Save changes</Button>
                        </SheetClose>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Interactive Components Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Interactive Components
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Collapsible</CardTitle>
                  <CardDescription>Expandable content sections</CardDescription>
                </CardHeader>
                <CardContent>
                  <Collapsible onOpenChange={setIsOpen} open={isOpen}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">
                        @peduarte starred 3 repositories
                      </h4>
                      <CollapsibleTrigger asChild>
                        <Button size="sm" type="button" variant="ghost">
                          <ChevronDown className="h-4 w-4" />
                          <span className="sr-only">Toggle</span>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <div className="rounded-md border px-4 py-3 text-sm">
                      @radix-ui/primitives
                    </div>
                    <CollapsibleContent className="space-y-2">
                      <div className="rounded-md border px-4 py-3 text-sm">
                        @radix-ui/colors
                      </div>
                      <div className="rounded-md border px-4 py-3 text-sm">
                        @stitches/react
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Hover Card</CardTitle>
                  <CardDescription>Rich hover previews</CardDescription>
                </CardHeader>
                <CardContent>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button type="button" variant="link">
                        @nextjs
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="flex justify-between space-x-4">
                        <Avatar>
                          <AvatarImage alt="Next.js" src="" />
                          <AvatarFallback>NJ</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-sm">@nextjs</h4>
                          <p className="text-sm">
                            The React Framework – created and maintained by
                            @vercel.
                          </p>
                          <div className="flex items-center pt-2">
                            <Calendar className="mr-2 h-4 w-4 opacity-70" />{" "}
                            <span className="text-muted-foreground text-xs">
                              Joined December 2021
                            </span>
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Scroll Area Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Scroll Area
            </h2>
            <Card>
              <CardHeader>
                <CardTitle>Scrollable Content</CardTitle>
                <CardDescription>Custom scrollbar styling</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  <div className="space-y-4">
                    {Array.from({ length: 50 }).map((_, i) => (
                      <div className="text-sm" key={i}>
                        Item {i + 1}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </section>

          {/* Carousel Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">Carousel</h2>
            <Card>
              <CardHeader>
                <CardTitle>Image Carousel</CardTitle>
                <CardDescription>Swipeable content slider</CardDescription>
              </CardHeader>
              <CardContent>
                <Carousel className="mx-auto w-full max-w-xs">
                  <CarouselContent>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <CarouselItem key={index}>
                        <div className="p-1">
                          <Card>
                            <CardContent className="flex aspect-square items-center justify-center p-6">
                              <span className="font-semibold text-4xl">
                                {index + 1}
                              </span>
                            </CardContent>
                          </Card>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious type="button" />
                  <CarouselNext type="button" />
                </Carousel>
              </CardContent>
            </Card>
          </section>

          {/* Toast Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Toast Notifications
            </h2>
            <Card>
              <CardHeader>
                <CardTitle>Toast Messages</CardTitle>
                <CardDescription>Temporary notification alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      toast({
                        type: "success",
                        description:
                          "Your changes have been saved successfully!",
                      });
                    }}
                    type="button"
                    variant="outline"
                  >
                    Show Success Toast
                  </Button>
                  <Button
                    onClick={() => {
                      toast({
                        type: "error",
                        description:
                          "An error occurred while processing your request.",
                      });
                    }}
                    type="button"
                    variant="outline"
                  >
                    Show Error Toast
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Separator Demo */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Separators
            </h2>
            <Card>
              <CardHeader>
                <CardTitle>Horizontal Separator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm leading-none">
                    Radix Primitives
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    An open-source UI component library.
                  </p>
                </div>
                <Separator className="my-4" />
                <div className="flex h-5 items-center space-x-4 text-sm">
                  <div>Blog</div>
                  <Separator orientation="vertical" />
                  <div>Docs</div>
                  <Separator orientation="vertical" />
                  <div>Source</div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Card Variants */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Card Variants
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Default Card</CardTitle>
                  <CardDescription>Card with all elements</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    This is a standard card with header, content, and footer.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" type="button">
                    Action
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Statistics Card</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-bold text-2xl">$45,231.89</div>
                  <p className="text-muted-foreground text-xs">
                    +20.1% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Actions Card</CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" type="button" variant="ghost">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Card with action menu
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Empty State Section */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">
              Empty States
            </h2>
            <Card className="flex flex-col items-center justify-center border-dashed p-8 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Info className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">No projects found</h3>
              <p className="mb-4 max-w-xs text-muted-foreground text-sm">
                You haven't created any projects yet. Start by creating your
                first project.
              </p>
              <Button size="sm" type="button">
                Create Project
              </Button>
            </Card>
          </section>

          {/* AI Thinking State */}
          <section className="space-y-4">
            <h2 className="font-semibold text-3xl tracking-tight">AI States</h2>
            <Card>
              <CardHeader>
                <CardTitle>Thinking State</CardTitle>
                <CardDescription>
                  Animated gradient text to indicate processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      Default AI Thinking
                    </p>
                    <div className="font-medium text-sm">
                      <span className="ai-thinking-gradient">
                        AI is thinking...
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      Large Heading Example
                    </p>
                    <div className="font-semibold text-2xl tracking-tight">
                      <span className="ai-thinking-gradient">
                        Generating your response...
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      Custom Color Gradient (Brand)
                    </p>
                    <div className="font-semibold text-xl">
                      <span className="animate-shimmer bg-[200%_auto] bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-400">
                        Optimizing your workflow...
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 md:h-14 md:flex-row">
          <p className="text-muted-foreground text-sm">
            Built with Next.js, Tailwind CSS, and Radix UI primitives.
          </p>
        </div>
      </footer>
    </div>
  );
}
