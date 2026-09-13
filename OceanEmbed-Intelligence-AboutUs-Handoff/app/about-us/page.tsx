"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import emailjs from "@emailjs/browser";
import "./about.css";

import SiteNavbar from "../../components/SiteNavbar";
import Footer from "../../components/Footer";

/* =========================================================
   IMAGE SOURCES
   ========================================================= */

const images = {
  satellite:
    "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?auto=format&fit=crop&w=1600&q=85",

  ocean:
    "https://images.unsplash.com/photo-1559825481-12a05cc00344?auto=format&fit=crop&w=1600&q=85",

  currents:
    "https://images.unsplash.com/photo-1530053969600-caed2596d242?auto=format&fit=crop&w=1600&q=85",

  underwater:
    "https://images.unsplash.com/photo-1544550285-f813152fb2fd?auto=format&fit=crop&w=1600&q=85",

  marine:
    "https://images.unsplash.com/photo-1518467166778-b88f373ffec7?auto=format&fit=crop&w=1600&q=85",

  surface:
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85",

  research:
    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1600&q=85",
};


/* =========================================================
   AUDIENCE
   ========================================================= */

const audiences = [
  {
    title: "RESEARCHERS",
    text: "Investigate ocean behaviour and patterns using deeper ocean information.",
    image: images.research,
  },
  {
    title: "DATA SCIENTISTS",
    text: "Explore how machine learning can uncover patterns inside environmental data.",
    image: images.satellite,
  },
  {
    title: "ENVIRONMENTAL SCIENTISTS",
    text: "Use reconstructed ocean information to understand changing conditions.",
    image: images.currents,
  },
  {
    title: "STUDENTS",
    text: "Explore ocean science through data, technology, and visual discovery.",
    image: images.marine,
  },
];


/* =========================================================
   APPLICATIONS
   ========================================================= */

const applications = [
  {
    title: "CLIMATE",
    text: "Understand the ocean's role in climate systems.",
  },
  {
    title: "RESEARCH",
    text: "Support deeper scientific investigation.",
  },
  {
    title: "MONITORING",
    text: "Build a clearer picture of changing conditions.",
  },
  {
    title: "EDUCATION",
    text: "Make complex ocean science easier to explore.",
  },
  {
    title: "DATA",
    text: "Turn environmental information into insight.",
  },
];


/* =========================================================
   IMAGE COMPONENT
   ========================================================= */

function OceanImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`visual-image ${className}`}>
      <div className="image-fallback" aria-hidden="true">
        <div className="fallback-grid" />
        <div className="fallback-glow" />

        <div className="fallback-wave wave-one" />
        <div className="fallback-wave wave-two" />
        <div className="fallback-wave wave-three" />
      </div>

      <img
        src={src}
        alt={alt}
        loading="lazy"
      />

      <div className="image-overlay" />
    </div>
  );
}


/* =========================================================
   ARROW
   ========================================================= */

function Arrow() {
  return (
    <div className="process-arrow" aria-hidden="true">
      <span />
      <b>→</b>
    </div>
  );
}


function ContactForm() {

  const form = useRef<HTMLFormElement>(null);

  const [status, setStatus] =
    useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const sendEmail = async (event: FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    if (!form.current || !(form.current instanceof HTMLFormElement)) {
      console.error("EmailJS error: Form element reference is invalid.");
      setErrorMessage("FORM REFERENCE INVALID.");
      setStatus("error");
      return;
    }

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

    const isServiceConfigured =
      Boolean(serviceId) && serviceId !== "YOUR_SERVICE_ID" && serviceId!.trim().length > 0;
    const isTemplateConfigured =
      Boolean(templateId) && templateId !== "YOUR_TEMPLATE_ID" && templateId!.trim().length > 0;
    const isPublicKeyConfigured =
      Boolean(publicKey) && publicKey !== "YOUR_PUBLIC_KEY" && publicKey!.trim().length > 0;

    if (!isServiceConfigured || !isTemplateConfigured || !isPublicKeyConfigured) {
      console.warn("Email service is not configured. Missing required environment variables.");
      setErrorMessage("Email service is not configured.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setErrorMessage("");

    try {
      const response = await emailjs.sendForm(
        serviceId as string,
        templateId as string,
        form.current,
        {
          publicKey: publicKey as string,
        }
      );

      console.log("EmailJS response success:", {
        status: response.status,
        text: response.text,
      });

      form.current.reset();
      setStatus("success");
    } catch (err: unknown) {
      const errorObj = err as Record<string, unknown> | null;
      const errorStatus = errorObj?.status ?? (err as { status?: number })?.status ?? "N/A";
      const errorText = errorObj?.text ?? (err as { text?: string })?.text ?? "N/A";
      const message = errorObj?.message ?? (err instanceof Error ? err.message : String(err));
      const name = errorObj?.name ?? (err instanceof Error ? err.name : "UnknownError");

      console.error("EmailJS submission failed:", {
        status: errorStatus,
        text: errorText,
        message,
        name,
      });

      if (typeof errorText === "string" && errorText !== "N/A" && errorText.length > 0) {
        setErrorMessage(`EMAILJS ERROR (${errorStatus}): ${errorText.toUpperCase()}`);
      } else if (typeof message === "string" && message.length > 0 && message !== "[object Object]") {
        setErrorMessage(`EMAILJS ERROR: ${message.toUpperCase()}`);
      } else {
        setErrorMessage("COULDN'T SEND THE MESSAGE. PLEASE TRY AGAIN.");
      }

      setStatus("error");
    }
  };

  return (
    <form ref={form} className="contact-form" onSubmit={sendEmail}>
      <div className="contact-form-row">
        <label>
          <span>YOUR NAME</span>
          <input
            type="text"
            name="from_name"
            placeholder="Enter your name"
            autoComplete="name"
            required
          />
        </label>

        <label>
          <span>YOUR EMAIL</span>
          <input
            type="email"
            name="reply_to"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
      </div>

      <label>
        <span>SUBJECT</span>
        <input
          type="text"
          name="subject"
          placeholder="What would you like to ask?"
          required
        />
      </label>

      <label>
        <span>YOUR QUERY</span>
        <textarea
          name="message"
          rows={5}
          placeholder="Tell us what you have in mind..."
          required
        />
      </label>

      <div className="contact-form-footer">
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "SENDING..." : "SEND MESSAGE →"}
        </button>

        <p className={`contact-status contact-status-${status}`} aria-live="polite">
          {status === "success" && "MESSAGE SENT. WE'LL GET BACK TO YOU SOON."}
          {status === "error" && (errorMessage || "COULDN'T SEND THE MESSAGE. PLEASE TRY AGAIN.")}
        </p>
      </div>
    </form>
  );
}


/* =========================================================
   ABOUT PAGE
   ========================================================= */

export default function AboutPage() {

  useEffect(() => {

    const elements =
      document.querySelectorAll<HTMLElement>(".about-reveal");

    const observer = new IntersectionObserver(
      (entries) => {

        entries.forEach((entry) => {

          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }

        });

      },
      {
        threshold: 0.02,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();

  }, []);


  return (
    <main
      className="about-page"
      id="top"
    >

      {/* =====================================================
          BACKGROUND
      ===================================================== */}

      <div
        className="about-ocean-background"
        aria-hidden="true"
      >

        <div className="ocean-surface-light" />

        <div className="ocean-rays">
          <span />
          <span />
          <span />
        </div>


        {/* FISH */}

        <svg
          className="about-fish-layer"
          viewBox="0 0 1600 900"
          preserveAspectRatio="none"
        >

          <g className="about-fish about-fish-a">

            <path
              d="M0 0 C22 -18 55 -18 76 0 C55 18 22 18 0 0Z"
              fill="#58c8df"
              opacity=".82"
            />

            <path
              d="M0 0 L-22 -17 L-19 0 L-22 17Z"
              fill="#3da4c2"
            />

            <circle
              cx="61"
              cy="-5"
              r="2.5"
              fill="#e7fbff"
            />

          </g>


          <g className="about-fish about-fish-b">

            <path
              d="M0 0 C18 -14 46 -14 64 0 C46 14 18 14 0 0Z"
              fill="#76d8d0"
              opacity=".7"
            />

            <path
              d="M0 0 L-18 -14 L-16 0 L-18 14Z"
              fill="#4bb4ad"
            />

            <circle
              cx="51"
              cy="-4"
              r="2"
              fill="#e7fbff"
            />

          </g>


          <g className="about-fish about-fish-c">

            <path
              d="M0 0 C20 -15 48 -15 68 0 C48 15 20 15 0 0Z"
              fill="#7ac7e8"
              opacity=".65"
            />

            <path
              d="M0 0 L-20 -15 L-17 0 L-20 15Z"
              fill="#4a9fca"
            />

            <circle
              cx="54"
              cy="-4"
              r="2"
              fill="#e7fbff"
            />

          </g>

        </svg>


        {/* PARTICLES */}

        <div className="about-particles">

          <span className="particle p1" />
          <span className="particle p2" />
          <span className="particle p3" />
          <span className="particle p4" />
          <span className="particle p5" />
          <span className="particle p6" />
          <span className="particle p7" />
          <span className="particle p8" />

        </div>

      </div>


      <SiteNavbar />


      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="about-hero">

        <div className="about-container">

          <div className="about-hero-inner about-reveal">

            <div className="about-hero-copy">

              <p className="about-kicker">
                ABOUT US
              </p>

              <h1 className="about-hero-title">

                <span className="about-hero-line meet-filled">
                  MEET
                </span>

                <span className="about-hero-line meet-outline">
                  OCEANEMBED
                </span>

              </h1>

              <p className="about-lead">
                We turn surface-level signals into a clearer
                understanding of the ocean beneath, helping
                us explore what is difficult to observe directly.
              </p>

              <div className="about-badges">

                <span>
                  SURFACE SIGNALS
                </span>

                <span>
                  SUBSURFACE INSIGHT
                </span>

                <span>
                  OCEAN INTELLIGENCE
                </span>

              </div>

            </div>


            <div className="about-hero-visual">

              <div className="hero-image-card hero-card-large">

                <OceanImage
                  src={images.satellite}
                  alt="Earth and ocean viewed from space"
                />

                <div className="card-label">
                  SURFACE VIEW
                </div>

              </div>


              <div className="hero-image-card hero-card-small">

                <OceanImage
                  src={images.underwater}
                  alt="Underwater ocean environment"
                />

                <div className="card-label">
                  HIDDEN DEPTH
                </div>

              </div>

            </div>

          </div>


          <div className="about-hero-story about-reveal">

            <p>
              OceanEmbed connects satellite observations,
              machine learning, and ocean science to reveal
              patterns that are difficult to see from the
              surface alone.
            </p>

          </div>

        </div>

      </section>


      {/* =====================================================
          01
      ===================================================== */}

      <section className="question-section">

        <div className="about-container problem-grid">

          <div className="question-heading about-reveal">

            <span className="section-marker">
              01
            </span>

            <span className="small-label">
              THE CHALLENGE
            </span>

            <h2>
              WHAT IS
              <br />
              <span>THE PROBLEM?</span>
            </h2>

          </div>


          <div className="problem-visual about-reveal">

            <OceanImage
              src={images.ocean}
              alt="Ocean surface"
              className="problem-image"
            />

            <div className="surface-tag">
              <span>VISIBLE</span>
              <strong>SURFACE</strong>
            </div>

            <div className="depth-tag">
              <span>HIDDEN</span>
              <strong>SUBSURFACE</strong>
            </div>

            <div className="depth-line">

              <span>0m</span>
              <i />

              <span>250m</span>
              <i />

              <span>500m</span>
              <i />

              <span>1000m</span>

            </div>

          </div>


          <div className="problem-copy about-reveal">

            <p className="answer-large">
              We can observe the ocean surface,
              but much of what happens beneath it remains hidden.
            </p>

            <p>
              Satellites provide valuable surface observations,
              while direct measurements at depth are limited.
              The challenge is connecting what we can see
              with what we cannot easily observe.
            </p>

            <div className="direction-line">

              <span>SURFACE</span>

              <Arrow />

              <span>DEPTH</span>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          02
      ===================================================== */}

      <section className="question-section oceanembed-section">

        <div className="about-container">

          <div className="oceanembed-layout">

            <div className="question-heading about-reveal">

              <span className="section-marker">
                02
              </span>

              <span className="small-label">
                THE IDEA
              </span>

              <h2>
                WHAT IS
                <br />
                <span>OCEANEMBED?</span>
              </h2>

            </div>


            <div className="oceanembed-answer about-reveal">

              <p className="answer-large">
                OceanEmbed is a deep-learning framework
                that uses surface observations to reconstruct
                subsurface ocean temperature.
              </p>

              <p>
                It learns relationships between observable
                surface signals and conditions below the surface.
              </p>

            </div>


            <div className="pipeline about-reveal">

              <div className="pipeline-step">

                <div className="pipeline-number">
                  01
                </div>

                <div className="pipeline-icon">
                  ◌
                </div>

                <h3>
                  SATELLITE DATA
                </h3>

                <p>
                  Surface observations provide the starting signals.
                </p>

              </div>


              <Arrow />


              <div className="pipeline-step pipeline-featured">

                <div className="pipeline-number">
                  02
                </div>

                <div className="pipeline-icon">
                  ✦
                </div>

                <h3>
                  DEEP LEARNING
                </h3>

                <p>
                  The model learns hidden relationships in the data.
                </p>

              </div>


              <Arrow />


              <div className="pipeline-step">

                <div className="pipeline-number">
                  03
                </div>

                <div className="pipeline-icon">
                  ↓
                </div>

                <h3>
                  SUBSURFACE
                  <br />
                  RECONSTRUCTION
                </h3>

                <p>
                  Learned patterns become estimates of temperature at depth.
                </p>

              </div>

            </div>


            <div className="mini-flow about-reveal">

              <span>OBSERVE</span>

              <i />

              <span>LEARN</span>

              <i />

              <span>RECONSTRUCT</span>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          03
      ===================================================== */}

      <section className="question-section">

        <div className="about-container purpose-layout">

          <div className="question-heading about-reveal">

            <span className="section-marker">
              03
            </span>

            <span className="small-label">
              THE PURPOSE
            </span>

            <h2>
              WHY DID
              <br />
              <span>WE BUILD IT?</span>
            </h2>

            <p className="heading-description">
              Because the ocean surface tells only part
              of the story.
            </p>

          </div>


          <div className="purpose-cards">

            <article className="purpose-card about-reveal">

              <OceanImage
                src={images.surface}
                alt="Ocean surface observation"
                className="purpose-image"
              />

              <div className="purpose-content">

                <span>01</span>

                <h3>
                  OBSERVE
                </h3>

                <p>
                  Start with the signals available at the surface.
                </p>

              </div>

            </article>


            <article className="purpose-card about-reveal">

              <OceanImage
                src={images.satellite}
                alt="Satellite observation"
                className="purpose-image"
              />

              <div className="purpose-content">

                <span>02</span>

                <h3>
                  LEARN
                </h3>

                <p>
                  Find relationships hidden inside complex ocean data.
                </p>

              </div>

            </article>


            <article className="purpose-card about-reveal">

              <OceanImage
                src={images.underwater}
                alt="Underwater ocean"
                className="purpose-image"
              />

              <div className="purpose-content">

                <span>03</span>

                <h3>
                  UNDERSTAND
                </h3>

                <p>
                  Use those patterns to explore what lies beneath.
                </p>

              </div>

            </article>

          </div>

        </div>

      </section>


      {/* =====================================================
          04 — PROCESS
      ===================================================== */}

      <section className="question-section process-section">

        <div className="about-container">

          {/* HEADER */}

          <div className="process-header about-reveal">

            <div className="process-heading">

              <span className="section-marker">
                04
              </span>

              <span className="small-label">
                THE PROCESS
              </span>

              <h2>
                HOW DOES
                <br />
                <span>IT WORK?</span>
              </h2>

            </div>


            <div className="process-intro">

              <div className="intro-line" />

              <p>
                From satellite observations to a deeper
                picture of the ocean.
              </p>

            </div>

          </div>


          {/* PROCESS FLOW */}

          <div className="process-wrapper about-reveal">

            <div className="process-track">

              {/* 01 */}

              <article className="process-node">

                <div className="node-top">
                  <span>01</span>
                  <span>INPUT</span>
                </div>

                <div className="node-symbol">
                  ◉
                </div>

                <h3>
                  SATELLITE
                </h3>

                <small>
                  OBSERVATIONS
                </small>

                <p>
                  Signals captured from the ocean surface.
                </p>

              </article>


              <Arrow />


              {/* 02 */}

              <article className="process-node">

                <div className="node-top">
                  <span>02</span>
                  <span>DATA</span>
                </div>

                <div className="node-symbol">
                  ≈
                </div>

                <h3>
                  SURFACE
                </h3>

                <small>
                  DATA
                </small>

                <p>
                  Multiple environmental signals become model inputs.
                </p>

              </article>


              <Arrow />


              {/* 03 */}

              <article className="process-node process-active">

                <div className="node-top">
                  <span>03</span>
                  <span>CORE</span>
                </div>

                <div className="node-symbol">
                  ✦
                </div>

                <h3>
                  MODEL
                </h3>

                <small>
                  LEARNING
                </small>

                <p>
                  Deep learning discovers relationships within the data.
                </p>

                <div className="active-pulse" />

              </article>


              <Arrow />


              {/* 04 */}

              <article className="process-node">

                <div className="node-top">
                  <span>04</span>
                  <span>OUTPUT</span>
                </div>

                <div className="node-symbol">
                  ↓
                </div>

                <h3>
                  RECONSTRUCTION
                </h3>

                <small>
                  DEPTH
                </small>

                <p>
                  Subsurface temperature is reconstructed across depth.
                </p>

              </article>


              <Arrow />


              {/* 05 */}

              <article className="process-node">

                <div className="node-top">
                  <span>05</span>
                  <span>CHECK</span>
                </div>

                <div className="node-symbol">
                  ✓
                </div>

                <h3>
                  VALIDATION
                </h3>

                <small>
                  ARGO
                </small>

                <p>
                  Independent observations help evaluate the reconstruction.
                </p>

              </article>

            </div>


            {/* PROCESS FOOTER */}

            <div className="process-footer">

              <div className="process-endpoint">

                <span>
                  INPUT
                </span>

                <strong>
                  WHAT WE CAN SEE
                </strong>

              </div>


              <div className="process-route">

                <i />

                <span>
                  LEARNING BRIDGE
                </span>

                <i />

              </div>


              <div className="process-endpoint process-endpoint-right">

                <span>
                  OUTPUT
                </span>

                <strong>
                  WHAT WE WANT TO UNDERSTAND
                </strong>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          05
      ===================================================== */}

      <section className="question-section audience-section">

        <div className="about-container">

          <div className="audience-header about-reveal">

            <div className="question-heading">

              <span className="section-marker">
                05
              </span>

              <span className="small-label">
                THE PEOPLE
              </span>

              <h2>
                WHO CAN
                <br />
                <span>USE IT?</span>
              </h2>

            </div>

            <p>
              Built for people who want to explore,
              interpret, and understand ocean data.
            </p>

          </div>


          <div className="audience-grid">

            {audiences.map((item, index) => (

              <article
                className="audience-card about-reveal"
                key={item.title}
                style={{
                  transitionDelay: `${index * 90}ms`,
                }}
              >

                <OceanImage
                  src={item.image}
                  alt={item.title}
                />

                <div className="audience-overlay">

                  <span className="audience-number">
                    0{index + 1}
                  </span>

                  <div>

                    <h3>
                      {item.title}
                    </h3>

                    <p>
                      {item.text}
                    </p>

                  </div>

                  <span className="card-arrow">
                    ↗
                  </span>

                </div>

              </article>

            ))}

          </div>

        </div>

      </section>


      {/* =====================================================
          06
      ===================================================== */}

      <section className="question-section application-section">

        <div className="about-container application-layout">

          <div className="question-heading about-reveal">

            <span className="section-marker">
              06
            </span>

            <span className="small-label">
              THE REACH
            </span>

            <h2>
              WHERE CAN
              <br />
              <span>IT HELP?</span>
            </h2>

            <p className="heading-description">
              From climate understanding to scientific
              exploration and education.
            </p>

          </div>


          <div className="application-map about-reveal">

            <div className="hub">

              <span>
                OCEAN
              </span>

              <strong>
                EMBED
              </strong>

            </div>


            {applications.map((item, index) => (

              <div
                className={`application-node node-${index + 1}`}
                key={item.title}
              >

                <span>
                  {item.title}
                </span>

                <p>
                  {item.text}
                </p>

              </div>

            ))}


            <div className="orbit orbit-one" />

            <div className="orbit orbit-two" />

          </div>

        </div>

      </section>


      {/* =====================================================
          07
      ===================================================== */}

      <section className="question-section impact-section">

        <div className="about-container impact-layout">

          <div className="impact-image about-reveal">

            <OceanImage
              src={images.currents}
              alt="Ocean currents"
            />

            <div className="impact-label label-climate">
              CLIMATE
            </div>

            <div className="impact-label label-heat">
              HEAT
            </div>

            <div className="impact-label label-circulation">
              CIRCULATION
            </div>

            <div className="impact-label label-ecosystems">
              ECOSYSTEMS
            </div>

          </div>


          <div className="impact-content about-reveal">

            <span className="section-marker">
              07
            </span>

            <span className="small-label">
              THE BIGGER PICTURE
            </span>

            <h2>
              WHY DOES
              <br />
              <span>IT MATTER?</span>
            </h2>

            <p className="answer-large">
              Understanding subsurface temperature
              helps reveal the deeper dynamics of our ocean.
            </p>

            <p>
              Ocean heat, circulation, climate, and ecosystems
              are connected. Seeing deeper gives us a better
              way to explore those connections.
            </p>

            <div className="impact-statement">

              <span>
                THE QUESTION
              </span>

              <strong>
                WHAT ELSE CAN WE LEARN WHEN THE OCEAN
                IS NO LONGER HIDDEN?
              </strong>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          CONTACT
      ===================================================== */}

      <section
        className="about-contact"
        id="contact"
      >

        <div className="about-container">

          <div className="contact-shell about-reveal">

            <span className="small-label">
              OCEANEMBED
            </span>

            <h2>
              LET&apos;S EXPLORE
              <br />
              <span>DEEPER.</span>
            </h2>

            <p>
              Have questions, ideas, or want to explore
              OceanEmbed further?
            </p>

            <ContactForm />

          </div>

        </div>

      </section>


      {/* =====================================================
          FINAL
      ===================================================== */}

      <section className="about-final">

        <div className="about-container">

          <div className="final-inner about-reveal">

            <span className="small-label">
              OCEANEMBED · SIH 2026
            </span>

            <h2>
              LOOK
              <br />
              <span>DEEPER.</span>
            </h2>

            <p>
              THE SURFACE IS ONLY THE BEGINNING.
            </p>

            <div className="final-line">

              <span>SURFACE</span>

              <i />

              <span>LEARNING</span>

              <i />

              <span>DEPTH</span>

            </div>

          </div>

        </div>

      </section>


      <Footer />

    </main>
  );
}