export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <main className="flex min-h-svh items-center justify-center p-4">{children}</main>
}
