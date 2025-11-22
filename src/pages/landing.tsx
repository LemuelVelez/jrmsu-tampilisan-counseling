import React from "react";
import Header from "../components/Header";
import HeroSection from "../components/HeroSection";
import BenefitsSection from "../components/BenefitsSection";
import HowItWorksSection from "../components/HowItWorksSection";
import Footer from "../components/Footer";

const LandingPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-linear-to-b from-yellow-50/80 via-amber-50/60 to-yellow-100/60">
            <Header />
            <main className="space-y-20 pb-16 pt-4 md:space-y-24 md:pt-8">
                <HeroSection />
                <BenefitsSection />
                <HowItWorksSection />
            </main>
            <Footer />
        </div>
    );
};

export default LandingPage;
