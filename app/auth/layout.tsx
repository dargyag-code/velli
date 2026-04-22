export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F0E8] px-4 py-8">
      {children}
    </div>
  );
}
