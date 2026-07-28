import { MotionConfig } from 'framer-motion'
import HeroSection from './components/sections/HeroSection'
import MarqueeSection from './components/sections/MarqueeSection'
import AboutSection from './components/sections/AboutSection'
import ServicesSection from './components/sections/ServicesSection'
import ProjectsSection from './components/sections/ProjectsSection'
import ProcessSection from './components/sections/ProcessSection'
import TestimonialsSection from './components/sections/TestimonialsSection'
import PricingSection from './components/sections/PricingSection'
import ContactSection from './components/sections/ContactSection'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <main className="bg-bg font-kanit" style={{ overflowX: 'clip' }}>
        <HeroSection />
        <MarqueeSection />
        <AboutSection />
        <ServicesSection />
        <ProjectsSection />
        <ProcessSection />
        <TestimonialsSection />
        <PricingSection />
        <ContactSection />
      </main>
    </MotionConfig>
  )
}
