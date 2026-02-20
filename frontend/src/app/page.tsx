import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import CapabilityRail from "@/components/landing/CapabilityRail";
import HowItWorksNarrative from "@/components/landing/HowItWorksNarrative";
import FeatureDeepDiveGrid from "@/components/landing/FeatureDeepDiveGrid";
import ExamCramShowcase from "@/components/landing/ExamCramShowcase";
import FaqSection from "@/components/landing/FaqSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      <LandingNavbar />
      <main>
        <HeroSection />
        <CapabilityRail />
        <HowItWorksNarrative />
        <FeatureDeepDiveGrid />
        <ExamCramShowcase />
        <FaqSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
