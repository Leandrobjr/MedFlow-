import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Link href="/login" className="text-blue-600 underline">
        Ir para o Login
      </Link>
    </div>
  );
}
