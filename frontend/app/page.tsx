import { TopNav } from '@/components/nav/TopNav';
import { BackendConnectivityCheck } from '@/components/BackendConnectivityCheck';

export default function Home() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <BackendConnectivityCheck />
    </main>
  );
}
