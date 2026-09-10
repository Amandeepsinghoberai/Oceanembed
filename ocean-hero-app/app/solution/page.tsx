import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import SolutionWorkspace from "@/components/solution/SolutionWorkspace";
import SolutionFeatures from "@/components/solution/SolutionFeatures";

export default function SolutionPage() {
  return (
    <main className="solution-page">
      <SiteNavbar />

      <SolutionWorkspace />
      <SolutionFeatures />

      <Footer />

      <style>{`
        .solution-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          /* Approved atmospheric background */
          background: linear-gradient(180deg, #78CBE9 0%, #3bb3cb 8%, #15799e 25%, #083c61 50%, #031124 75%, #01070e 100%);
        }
      `}</style>
    </main>
  );
}
