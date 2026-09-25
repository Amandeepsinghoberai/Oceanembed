"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * OceanEmbed scroll hero — boat + satellite at the surface,
 * an Argo float descending to 1000 m as the page scrolls.
 *
 * Usage: import OceanHero from "@/components/OceanHero";
 *        place <OceanHero /> as the FIRST element on the homepage.
 *
 * Notes:
 * - This is a single-instance component. It uses element IDs
 *   internally (getElementById), so rendering it twice on one
 *   page will cause the two copies to fight over the same IDs.
 * - All layout inside is computed from the visible viewport at
 *   runtime (see the FX / FY fractions in the script below) —
 *   don't hardcode pixel positions if you extend this.
 */

const MARKUP = `
<section class="ocean-track" id="track">
  <div class="ocean-stage">

    <svg class="ocean-scene" id="scene" viewBox="0 0 1440 900"
         preserveAspectRatio="xMidYMid slice" aria-label="A sailing vessel on the surface links to a satellite while an Argo float descends to one thousand metres.">

      <defs>
        <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0"   stop-color="#8fdcf6"/>
          <stop offset="1"   stop-color="#31addf"/>
        </linearGradient>

        <!-- Water colour. JS rewrites these two stops as depth increases. -->
        <linearGradient id="waterG" x1="0" y1="0" x2="0" y2="1">
          <stop id="wTop" offset="0"   stop-color="#29b6ef"/>
          <stop id="wBot" offset="1"   stop-color="#0d74b5"/>
        </linearGradient>

        <linearGradient id="fadeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000814" stop-opacity="0"/>
          <stop offset="1" stop-color="#000814" stop-opacity="1"/>
        </linearGradient>

        <!-- Keeps depth marks, light shafts and marine snow underwater. -->
        <clipPath id="belowWater">
          <rect id="clipRect" x="0" y="430" width="1440" height="1200"/>
        </clipPath>

        <radialGradient id="haloG">
          <stop offset="0"   stop-color="#8fe8ff" stop-opacity=".26"/>
          <stop offset=".6"  stop-color="#5fc9f0" stop-opacity=".07"/>
          <stop offset="1"   stop-color="#5fc9f0" stop-opacity="0"/>
        </radialGradient>

        <radialGradient id="glowG">
          <stop offset="0"   stop-color="#ffeeb8" stop-opacity=".8"/>
          <stop offset=".55" stop-color="#ffe08a" stop-opacity=".22"/>
          <stop offset="1"   stop-color="#ffe08a" stop-opacity="0"/>
        </radialGradient>

        <linearGradient id="rayG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d8f6ff" stop-opacity=".20"/>
          <stop offset="1" stop-color="#d8f6ff" stop-opacity="0"/>
        </linearGradient>

        <linearGradient id="panelG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6ddcf8"/><stop offset="1" stop-color="#1c6fb0"/>
        </linearGradient>

        <linearGradient id="jibG" x1=".1" y1="0" x2=".9" y2="1">
          <stop offset="0" stop-color="#eaf7fd" stop-opacity=".62"/>
          <stop offset="1" stop-color="#bfe4f5" stop-opacity=".42"/>
        </linearGradient>
        <linearGradient id="sailA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".96"/>
          <stop offset="1" stop-color="#cbe8f7" stop-opacity=".78"/>
        </linearGradient>
        <linearGradient id="sailB" x1=".1" y1="0" x2="1" y2=".9">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".98"/>
          <stop offset="1" stop-color="#bfe1f4" stop-opacity=".72"/>
        </linearGradient>

        <linearGradient id="argoBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#f0a91c"/>
          <stop offset=".45" stop-color="#ffd23f"/>
          <stop offset="1" stop-color="#e09310"/>
        </linearGradient>
        <linearGradient id="argoCap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#dcedf5"/>
          <stop offset=".45" stop-color="#ffffff"/>
          <stop offset="1" stop-color="#bcd7e4"/>
        </linearGradient>
        <radialGradient id="sunOrb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff8db" stop-opacity="1"/>
          <stop offset="100%" stop-color="#ffeba1" stop-opacity="1"/>
        </radialGradient>
        <radialGradient id="sunAuro" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffeba1" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#ffeba1" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="sunOrb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff8db" stop-opacity="1"/>
          <stop offset="100%" stop-color="#ffeba1" stop-opacity="1"/>
        </radialGradient>
        <radialGradient id="sunAuro" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffeba1" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#ffeba1" stop-opacity="0"/>
        </radialGradient>
        <symbol id="school1" overflow="visible">
          <!-- Small sleek fish -->
          <path d="M0,0 Q12,-6 24,0 Q12,6 0,0Z M4,-1 L8,0 L8,-3Z M25,0 L32,3 L32,-3Z" fill="currentColor"/>
          <path d="M12,-3 Q18,0 12,3" fill="none" stroke="#aee6f5" stroke-width="0.5" opacity="0.6"/>
          <!-- offset fish in school -->
          <path d="M-15,10 Q-3,4 9,10 Q-3,16 -15,10Z M-11,9 L-7,10 L-7,7Z M9,10 L16,13 L16,7Z" fill="currentColor"/>
          <path d="M20,15 Q32,9 44,15 Q32,21 20,15Z M24,14 L28,15 L28,12Z M44,15 L51,18 L51,12Z" fill="currentColor"/>
          <path d="M-5,-12 Q7,-18 19,-12 Q7,-6 -5,-12Z M-1,-13 L3,-12 L3,-15Z M19,-12 L26,-9 L26,-15Z" fill="currentColor"/>
        </symbol>
        <symbol id="school2" overflow="visible">
          <!-- Tighter school -->
          <path d="M0,0 Q8,-3 16,0 Q8,3 0,0Z M16,0 L21,2 L21,-2Z" fill="currentColor"/>
          <path d="M-5,-10 Q3,-13 11,-10 Q3,-7 -5,-10Z M11,-10 L16,-8 L16,-12Z" fill="currentColor"/>
          <path d="M15,8 Q23,5 31,8 Q23,11 15,8Z M31,8 L36,10 L36,6Z" fill="currentColor"/>
          <path d="M-15,6 Q-7,3 1,6 Q-7,9 -15,6Z M1,6 L6,8 L6,4Z" fill="currentColor"/>
        </symbol>
        <symbol id="ray" overflow="visible">
          <!-- Stylized manta ray with graceful wings -->
          <path d="M0,0 C25,-15 45,-25 70,-10 C90,-35 70,5 50,20 C30,35 15,30 0,0 Z" fill="currentColor"/>
          <path d="M0,0 C25,15 45,25 70,10 C90,35 70,-5 50,-20 C30,-35 15,-30 0,0 Z" fill="currentColor"/>
          <path d="M70,-10 L75,0 L70,10 Z" fill="currentColor"/>
          <path d="M10,0 C30,-5 50,0 60,0" fill="none" stroke="#71a9cf" stroke-width="1.5" opacity="0.6"/>
        </symbol>
        <symbol id="turtle" overflow="visible">
          <path d="M20,0 C30,-15 50,-15 60,0 C50,10 30,10 20,0Z M60,-2 C70,-5 75,0 60,2 Z M30,-4 C50,-20 40,10 30,-4Z M50,-4 C55,-15 45,5 50,-4Z" fill="currentColor"/>
        </symbol>
        <symbol id="jellyfish" overflow="visible">
          <!-- Layered glowing jellyfish -->
          <path d="M0,0 C-5,-20 15,-30 25,-30 C35,-30 55,-20 50,0 Z" fill="currentColor" opacity="0.8"/>
          <path d="M5,0 Q25,-15 45,0 Z" fill="#bcf1ff" opacity="0.4"/>
          <!-- Flowing tentacles -->
          <g stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.6">
            <path d="M10,0 Q5,20 15,40 T10,70" />
            <path d="M20,0 Q30,25 20,45 T25,75" stroke-width="2"/>
            <path d="M30,0 Q25,30 35,50 T30,80" />
            <path d="M40,0 Q45,20 35,35 T40,65" />
          </g>
        </symbol>
        <symbol id="squid" overflow="visible">
          <!-- Elegant vector octopus/squid -->
          <path d="M15,-20 C0,-35 40,-35 25,-20 C40,0 35,10 20,15 C5,10 0,0 15,-20 Z" fill="currentColor"/>
          <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M10,5 Q-5,25 5,45 T-5,70"/>
            <path d="M15,10 Q5,30 20,50 T15,75"/>
            <path d="M25,10 Q35,30 20,50 T30,80"/>
            <path d="M30,5 Q45,25 35,45 T45,70"/>
          </g>
          <circle cx="12" cy="-15" r="1.5" fill="#aee6f5" opacity="0.8"/>
          <circle cx="28" cy="-15" r="1.5" fill="#aee6f5" opacity="0.8"/>
        </symbol>
        <symbol id="deepfish" overflow="visible">
          <!-- Stylized deep sea fish -->
          <path d="M0,0 C15,-15 35,-10 45,0 C35,10 15,15 0,0 Z M45,0 L55,8 L52,-6 Z" fill="currentColor"/>
          <path d="M10,-10 C20,-15 30,-5 20,-2 Z M25,5 C35,10 40,5 35,0 Z" fill="currentColor"/>
          <!-- Glowing lure -->
          <path d="M10,-10 Q0,-25 -10,-15" fill="none" stroke="#7ce0d0" stroke-width="1.5"/>
          <circle cx="-10" cy="-15" r="3" fill="#bef7ed"/>
        </symbol>
      </defs>

      <!-- 1 · sky -->
      <rect width="1440" height="900" fill="#3fb5e6"/>
      <rect width="1440" height="900" fill="url(#skyG)" opacity=".9"/>
      <rect id="skyDim" width="1440" height="900" fill="#03172c" opacity="0"/>

      <!-- 1.1 · SUN -->
      <g id="sun" transform="translate(1100, 180)">
        <circle r="160" fill="url(#sunAuro)" />
        <circle r="46" fill="url(#sunOrb)" />
      </g>

      <!-- 1.2 · CLOUDS -->
      <g id="clouds" fill="#ffffff" opacity="0.55" style="pointer-events: none;">
        <g class="cloud-move-1">
          <g transform="translate(180, 150) scale(1.1)">
            <rect x="0" y="0" width="120" height="20" rx="10" />
            <circle cx="35" cy="0" r="20" />
            <circle cx="75" cy="-5" r="30" />
          </g>
        </g>
        <g class="cloud-move-2">
          <g transform="translate(850, 110) scale(0.85)">
            <rect x="0" y="0" width="150" height="24" rx="12" />
            <circle cx="45" cy="0" r="25" />
            <circle cx="95" cy="-5" r="35" />
            <circle cx="130" cy="5" r="15" />
          </g>
        </g>
        <g class="cloud-move-3">
          <g transform="translate(-100, 240) scale(1.4)">
            <rect x="0" y="0" width="100" height="16" rx="8" />
            <circle cx="30" cy="0" r="15" />
            <circle cx="65" cy="-2" r="22" />
          </g>
        </g>
        <g class="cloud-move-4">
          <g transform="translate(1300, 260) scale(1.0)">
            <rect x="0" y="0" width="130" height="18" rx="9" />
            <circle cx="40" cy="0" r="18" />
            <circle cx="85" cy="-4" r="26" />
          </g>
        </g>
      </g>

      <!-- 2 · sun / satellite glow -->
      <circle id="glow" class="anim" cx="0" cy="0" r="230" fill="url(#glowG)"/>

      <!-- 3 · water body (its top edge is the wave line) -->
      <g id="waterWrap" class="anim">
        <path id="waterBody" fill="url(#waterG)"
          d="M -260 0 Q -140 -11 -20 0 T 220 0 T 460 0 T 700 0 T 940 0 T 1180 0 T 1420 0 T 1660 0 L 1700 1500 L -300 1500 Z"/>
      </g>

      <!-- 4-8 · everything that must never appear above the waterline -->
      <g clip-path="url(#belowWater)">

      <!-- 4 · light shafts -->
      <g id="rays" class="anim" opacity="1">
        <path fill="url(#rayG)" d="M 300 0 L 420 0 L 300 760 L 244 760 Z"/>
        <path fill="url(#rayG)" d="M 640 0 L 806 0 L 700 820 L 620 820 Z"/>
        <path fill="url(#rayG)" d="M 1030 0 L 1120 0 L 1010 700 L 962 700 Z"/>
      </g>

      <!-- 5 · deep darkening -->
      <rect id="deepFade" x="0" y="300" width="1440" height="600" fill="url(#fadeG)" opacity="0"/>

      <!-- 13.1 · MARINE ECOSYSTEM -->
      <g id="marineFish" class="anim">
        <g class="marine-moving-slow" opacity="0.8" fill="#71a9cf">
          <use href="#school1" x="380" y="-20" transform="scale(0.8)"/>
          <use href="#school2" x="430" y="5" transform="scale(0.6)"/>
          <use href="#school1" x="250" y="20" transform="scale(0.7)"/>
        </g>
      </g>
      <g id="marineShark" class="anim" opacity="0.85">
        <g class="marine-swimming">
          <!-- Sleek, stylized shark -->
          <path d="M600,0 C630,-10 680,0 720,-10 C740,-15 760,-5 720,5 C680,15 630,10 600,0 Z" fill="#1b587d"/>
          <path d="M600,0 C630,5 680,15 720,5 C700,5 650,2 600,0 Z" fill="#0f344e"/>
          <!-- Dorsal fin -->
          <path d="M660,-5 C670,-20 680,-25 680,-4 C675,-3 660,-5 660,-5 Z" fill="#1b587d"/>
          <!-- Pectoral fin -->
          <path d="M670,3 C660,18 640,25 650,5 Z" fill="#09293e"/>
          <path d="M610,-2 C640,-10 680,-2 710,-7" fill="none" stroke="#71a9cf" stroke-width="1.5" opacity="0.6"/>
          <!-- Small accompanying remoras -->
          <use href="#school2" x="650" y="8" transform="scale(0.3)" fill="#71a9cf"/>
        </g>
      </g>
      <g id="marineWhale" class="anim" opacity="0.9">
        <g class="marine-swimming-slow" fill="#0d3152">
          <!-- Distant Whale Silhouette -->
          <g transform="translate(600, -100) scale(0.6)" opacity="0.4">
            <path d="M1000,0 C1100,-80 1300,-20 1400,0 C1450,5 1450,20 1400,10 C1200,40 1100,60 1000,0 Z" fill="#0a223a"/>
            <path d="M1400,5 C1440,-10 1470,-30 1460,10 C1480,30 1460,50 1430,10 Z" fill="#0a223a"/>
          </g>
          <!-- Main Whale Redesigned (Elegant Vector Silhouette) -->
          <g transform="translate(0, 40)">
            <!-- Main Body -->
            <path d="M1000,0 C1100,-80 1300,-20 1400,0 C1450,5 1450,15 1400,10 C1200,35 1100,40 1000,0 Z" fill="#0d3152"/>
            <!-- Ventral pleats styling -->
            <path d="M1050,15 C1150,45 1250,25 1300,5 C1200,30 1100,25 1050,15 Z" fill="#1b476e" opacity="0.4"/>
            <!-- Subtle contour overlay -->
            <path d="M1020,-10 C1150,-70 1280,-10 1380,-2" fill="none" stroke="#71a9cf" stroke-width="2" opacity="0.6"/>
            <!-- Tail -->
            <path d="M1400,5 C1440,-15 1470,-35 1470,0 C1485,35 1455,45 1430,10 Z" fill="#0d3152"/>
            <!-- Pectoral Fin -->
            <path d="M1120,10 C1100,60 1030,110 1070,60 C1090,35 1110,15 1120,10 Z" fill="#071b2e"/>
          </g>
          <!-- Replace squid with ray -->
          <use href="#ray" x="1800" y="160" transform="scale(0.8)" opacity="0.75" fill="#144a6b"/>
          <use href="#ray" x="1650" y="210" transform="scale(0.6)" opacity="0.6" fill="#144a6b"/>
        </g>
        <g class="marine-swimming" fill="#0c3c5e" opacity="0.65">
          <use href="#school1" x="1400" y="120" transform="scale(1.2)"/>
          <use href="#school2" x="1700" y="240" transform="scale(1.5)" opacity="0.8"/>
        </g>
        <g class="marine-moving-slow" fill="#0a2e47" opacity="0.5">
          <use href="#school2" x="300" y="90" transform="scale(0.8)"/>
          <use href="#school1" x="800" y="220" transform="scale(0.6)"/>
        </g>
      </g>
      <g id="marineOcto" class="anim" opacity="0.85">
        <g class="marine-bobbing" transform="translate(500,40)">
          <!-- Elegantly styled vector octopus -->
          <use href="#squid" x="0" y="-80" transform="scale(1.2)" fill="#1c557a"/>
          <g fill="none" stroke="#256b96" stroke-width="8" stroke-linecap="round" class="tentacles-sway">
            <path d="M25,-25 C10,10 0,40 15,70" />
            <path d="M35,-22 C20,15 25,55 35,80" />
            <path d="M45,-22 C60,20 55,60 45,90" />
            <path d="M55,-25 C70,10 80,40 65,70" />
          </g>
        </g>
        <g class="jelly-float-1" fill="#144a6b">
          <use href="#jellyfish" x="200" y="80" transform="scale(1.2)" />
          <use href="#jellyfish" x="1100" y="30" transform="scale(0.8)" opacity="0.6" />
        </g>
        <g class="jelly-float-2" fill="#09293e">
          <use href="#jellyfish" x="800" y="160" transform="scale(1.5)" opacity="0.8"/>
          <use href="#jellyfish" x="1300" y="120" transform="scale(0.6)" opacity="0.4" />
        </g>
        <g class="marine-swimming-slow" fill="#071b2e">
          <use href="#deepfish" x="1600" y="140" transform="scale(1.2)" opacity="0.9"/>
          <use href="#deepfish" x="1800" y="60" transform="scale(0.8)" opacity="0.6"/>
          <use href="#deepfish" x="2100" y="200" transform="scale(1.5)" opacity="0.8"/>
        </g>
        <g class="marine-moving-slow" fill="#051221" opacity="0.5">
          <use href="#school1" x="100" y="50" transform="scale(0.6)"/>
          <use href="#school2" x="1200" y="180" transform="scale(0.4)"/>
        </g>
      </g>
      <g id="marineBed" class="anim">
        <!-- Background seabed elements -->
        <g class="marine-moving-slow" fill="#03182b" opacity="0.6">
          <use href="#school2" x="300" y="450" transform="scale(0.6)"/>
          <use href="#school1" x="900" y="520" transform="scale(0.4)"/>
        </g>

        <!-- Warm Sandy Seabed -->
        <path d="M-100,500 Q 200,420 700,520 T 1500,480 L 1500,900 L -100,900 Z" fill="#b57a45"/>
        <path d="M-100,560 Q 500,620 900,550 T 1500,580 L 1500,900 L -100,900 Z" fill="#a46938"/>
        
        <!-- Geological depths / hills -->
        <path d="M 120,530 Q 150,420 220,530 Q 250,560 200,620 Z" fill="#9c5f2b"/>
        <path d="M 80,590 Q 150,500 280,580 L 80,680 Z" fill="#8d5627"/>
        <path d="M 1150,540 Q 1200,460 1280,520 Q 1330,560 1200,610 Z" fill="#9c5f2b"/>
        <path d="M 1250,570 Q 1350,480 1450,580 L 1200,680 Z" fill="#885224"/>
        
        <!-- Deeper Soil (seamless footer match) -->
        <path d="M-100,630 Q 300,590 800,650 T 1500,600 L 1500,900 L -100,900 Z" fill="#956039"/>

        <!-- Distant Background Rocks -->
        <g fill="#8f5728" opacity="0.65">
          <path d="M 400,530 Q 420,480 470,540 Q 520,530 550,580 L 400,600 Z"/>
          <path d="M 920,510 Q 980,420 1050,480 Q 1120,490 1080,560 L 920,550 Z"/>
        </g>

        <!-- Midground Rocks (Layered) -->
        <g>
          <path d="M 380,540 C 410,480 480,520 460,560 C 450,570 410,580 380,540 Z" fill="#7a461f"/>
          <path d="M 410,520 C 430,490 460,510 445,540 Z" fill="#8d5627"/>
          <path d="M 1000,530 C 1040,490 1100,520 1080,570 C 1060,590 1010,580 1000,530 Z" fill="#72411e"/>
          <path d="M 1030,510 C 1050,480 1080,510 1065,540 Z" fill="#8f5728"/>
        </g>

        <!-- Foreground Detailed Rocks & Coral Clusters -->
        <g class="marine-sway" style="transform-origin: bottom; animation: gentle-sway 10s ease-in-out infinite;">
          <!-- Branching Coral Left -->
          <g stroke="#c9745b" stroke-width="4" fill="none" stroke-linecap="round" style="transform-origin: 430px 580px; animation: gentle-sway 8s infinite -2s;">
            <path d="M420,580 Q400,540 385,520" />
            <path d="M420,580 Q435,530 445,495" />
            <path d="M430,550 Q460,530 475,510" />
            <path d="M410,540 Q390,510 380,490" stroke-width="3"/>
          </g>
          <!-- Tube Coral Right -->
          <g fill="#935757">
            <path d="M1010,560 C1015,530 1025,510 1020,510 C1015,510 1005,530 1000,560 Z"/>
            <path d="M1025,570 C1035,520 1045,490 1035,490 C1025,490 1015,520 1015,570 Z"/>
            <path d="M1040,560 C1055,530 1065,510 1055,510 C1045,510 1030,530 1030,560 Z"/>
          </g>
        </g>

        <!-- Complex Seaweed & Kelp (Left Cluster) -->
        <g stroke-linecap="round" fill="none" style="transform-origin: 220px 600px; animation: kelp-drift 14s ease-in-out infinite;">
          <g stroke="#1a3c28" stroke-width="6" style="animation: gentle-sway 11s infinite -5s; transform-origin: 220px 600px;">
            <path d="M220,590 Q200,480 240,400 Q260,320 220,240"/>
            <path d="M230,580 Q260,490 230,410 Q210,340 250,260"/>
          </g>
          <g stroke="#2a523b" stroke-width="4" style="animation: gentle-sway 9s infinite -2s; transform-origin: 220px 600px;">
            <path d="M210,600 Q170,520 200,430 Q220,350 190,260"/>
            <path d="M240,610 Q280,540 250,450 Q230,370 270,280"/>
            <path d="M200,590 Q150,540 170,470" stroke-width="3"/>
          </g>
        </g>

        <!-- Complex Seaweed & Kelp (Right Cluster) -->
        <g stroke-linecap="round" fill="none" style="transform-origin: 1250px 600px; animation: kelp-drift 12s ease-in-out infinite -4s;">
          <g stroke="#1b422a" stroke-width="7" style="animation: gentle-sway 13s infinite -1s; transform-origin: 1250px 600px;">
            <path d="M1250,580 Q1220,490 1280,400 Q1310,300 1260,200"/>
            <path d="M1280,590 Q1330,500 1280,410 Q1240,320 1300,220"/>
          </g>
          <g stroke="#3a664e" stroke-width="4" style="animation: gentle-sway 10s infinite -6s; transform-origin: 1250px 600px;">
            <path d="M1230,600 Q1190,520 1220,440 Q1240,350 1190,250"/>
            <path d="M1260,610 Q1310,540 1270,450 Q1240,360 1280,260"/>
            <path d="M1290,570 Q1360,500 1320,410" stroke-width="3"/>
          </g>
        </g>

        <!-- Subtle Fauna (Starfish, Crab, Urchins) -->
        <g>
          <!-- Starfish on left sand -->
          <path d="M 320,530 L 322,525 L 327,526 L 324,530 L 326,535 L 320,533 L 314,535 L 316,530 L 313,526 L 318,525 Z" fill="#b05844"/>
          <!-- Starfish on right rock -->
          <path d="M 1040,540 L 1043,534 L 1050,536 L 1045,541 L 1047,547 L 1040,544 L 1033,547 L 1035,541 L 1030,536 L 1037,534 Z" fill="#c46a56" transform="rotate(20 1040 540) scale(0.8)"/>
          
          <!-- Small Crab Silhouette -->
          <g fill="#5a3124" transform="translate(680, 560)">
            <ellipse cx="0" cy="0" rx="6" ry="4"/>
            <path d="M-6,0 Q-10,-4 -12,2 M6,0 Q10,-4 12,2" stroke="#5a3124" stroke-width="1.5" fill="none"/>
            <path d="M-4,4 Q-6,8 -8,6 M4,4 Q6,8 8,6" stroke="#5a3124" stroke-width="1.5" fill="none"/>
          </g>

          <!-- Shadowy Sea Urchins -->
          <circle cx="480" cy="570" r="4" fill="#2d1c1c"/>
          <circle cx="484" cy="573" r="3" fill="#2d1c1c"/>
          <circle cx="476" cy="574" r="3" fill="#2d1c1c"/>
          <circle cx="980" cy="580" r="5" fill="#362222"/>
          <circle cx="973" cy="582" r="3" fill="#362222"/>
        </g>

        <!-- Foreground Bed Wildlife -->
        <g class="marine-swimming-slow" fill="#09293e">
           <use href="#school1" x="1400" y="520" transform="scale(0.8)"/>
           <!-- Use ray/manta -->
           <use href="#ray" x="1700" y="580" transform="scale(0.4)" opacity="0.6"/>
        </g>

        <g class="bed-bubbles" fill="#ffffff" opacity="0.15">
          <circle cx="230" cy="400" r="2" />
          <circle cx="250" cy="350" r="1.5" />
          <circle cx="430" cy="460" r="1.8" />
          <circle cx="1040" cy="420" r="2.2" />
          <circle cx="1270" cy="450" r="2.5" />
          <circle cx="1290" cy="380" r="1.5" />
        </g>
      </g>

      <!-- 6 · marine snow (built by JS) -->
      <g id="snow" opacity="0"></g>

      <!-- 7 · depth ruler -->
      <g id="ruler" class="anim" opacity="0"></g>

      <!-- 8 · guide line at the float's depth -->
      <g id="guide" class="anim" opacity="0">
        <path d="M 0 0 H 1440" stroke="#bfeeff" stroke-opacity=".22" stroke-width="1.5" stroke-dasharray="2 10"/>
      </g>

      </g><!-- /clip -->

      <!-- 9 · tether -->
      <path id="wire" fill="none" stroke="#cfeeff" stroke-opacity=".72" stroke-width="2.2" stroke-linecap="round"/>

      <!-- 10 · BOAT -->
      <g id="boat" class="anim">
        <g transform="translate(-232,-258)">
          <g stroke="#dff1fb" stroke-opacity=".5" stroke-width="1.3" fill="none">
            <path d="M286 38 L 172 70"/><path d="M286 38 L 400 240"/>
            <path d="M172 70 L 92 240"/><path d="M286 38 L 246 240"/>
          </g>
          <path d="M70 240 L 24 231" stroke="#123a5c" stroke-width="6" stroke-linecap="round"/>
          <path d="M170 70 L 170 238 L 40 238 C 92 220 142 160 170 70 Z" fill="url(#jibG)"/>
          <path d="M178 84 C 246 132 288 186 286 238 L 178 238 Z" fill="url(#sailA)"/>
          <path d="M292 44 C 356 106 382 184 374 238 L 292 238 Z" fill="url(#sailB)"/>
          <rect x="167" y="64" width="6" height="176" rx="3" fill="#123a5c"/>
          <rect x="283" y="32" width="6" height="208" rx="3" fill="#123a5c"/>
          <path d="M289 34 L 345 48 L 289 61 Z" fill="#2ec4a6"/>
          <rect x="206" y="216" width="72" height="19" rx="3" fill="#f4fcff"/>
          <circle cx="224" cy="225.5" r="3" fill="#123a5c" opacity=".5"/>
          <circle cx="242" cy="225.5" r="3" fill="#123a5c" opacity=".5"/>
          <circle cx="260" cy="225.5" r="3" fill="#123a5c" opacity=".5"/>
          <path d="M60 236 L 404 236 L 398 248 L 66 248 Z" fill="#2ec4a6"/>
          <path d="M60 246 L 398 246 C 386 278 330 292 252 292 L 168 292 C 100 288 66 272 60 246 Z" fill="#123a5c"/>
          <circle cx="112" cy="262" r="4.6" fill="#7fd8f0" opacity=".85"/>
        </g>
      </g>

      <!-- 11 · wave strokes, drawn over the hull -->
      <g id="waves" class="anim">
        <path id="w1" fill="none" stroke="#eaf9ff" stroke-opacity=".9"  stroke-width="4" stroke-linecap="round"
          d="M -260 0 Q -140 -13 -20 0 T 220 0 T 460 0 T 700 0 T 940 0 T 1180 0 T 1420 0 T 1660 0"/>
        <path id="w2" fill="none" stroke="#9fe9dd" stroke-opacity=".75" stroke-width="3" stroke-linecap="round"
          d="M -260 16 Q -140 5 -20 16 T 220 16 T 460 16 T 700 16 T 940 16 T 1180 16 T 1420 16 T 1660 16"/>
        <path id="w3" fill="none" stroke="#eaf9ff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"
          stroke-dasharray="26 20"
          d="M -260 30 Q -140 22 -20 30 T 220 30 T 460 30 T 700 30 T 940 30 T 1180 30 T 1420 30 T 1660 30"/>
      </g>

      <!-- 12 · SATELLITE -->
      <g id="sat" class="anim">
        <g transform="rotate(-12)">
          <rect x="-78" y="-18" width="52" height="36" rx="3" fill="url(#panelG)"/>
          <rect x="26"  y="-18" width="52" height="36" rx="3" fill="url(#panelG)"/>
          <g stroke="#0a4a7a" stroke-opacity=".45" stroke-width="1.5">
            <path d="M-61 -18 V18 M-43 -18 V18 M-78 0 H-26"/>
            <path d="M43 -18 V18 M61 -18 V18 M26 0 H78"/>
          </g>
          <rect x="-28" y="-3" width="56" height="6" rx="1" fill="#0f3a5f"/>
          <rect x="-17" y="-24" width="34" height="46" rx="6" fill="#f4fcff"/>
          <rect x="-17" y="-8"  width="34" height="9" fill="#2ec4a6"/>
          <rect x="-1.8" y="-34" width="3.6" height="11" rx="1.8" fill="#0f3a5f"/>
          <circle cy="-36" r="3.4" fill="#2ec4a6"/>
          <rect x="-2" y="22" width="4" height="11" fill="#0f3a5f"/>
          <path d="M-19 33 A 19 15 0 0 0 19 33 Z" fill="#cfe9f7"/>
          <path d="M-19 33 A 19 15 0 0 0 19 33" fill="none" stroke="#8fc4dd" stroke-width="1.6"/>
          <circle cy="34" r="3" fill="#0f3a5f"/>
        </g>
      </g>

      <!-- 13 · uplink beam + travelling data packets -->
      <path id="beam" fill="none" stroke="#dff4ff" stroke-opacity=".7"
            stroke-width="2.4" stroke-dasharray="10 12" stroke-linecap="round"/>
      <g id="packets">
        <circle r="4" fill="#eafcff"/><circle r="4" fill="#eafcff"/><circle r="4" fill="#eafcff"/>
      </g>

      <!-- 14 · ARGO FLOAT -->
      <g id="argo" class="anim">
        <circle id="argoHalo" cy="10" r="150" fill="url(#haloG)" opacity="0"/>
        <g transform="translate(0,-60)">
          <path d="M0 -34 V 4" stroke="#dff1fb" stroke-width="2" stroke-dasharray="4 4" opacity=".75"/>
          <circle cy="-36" r="4.5" fill="#f2fbff"/>
          <rect x="-13" y="4"  width="26" height="14" rx="6" fill="url(#argoCap)"/>
          <rect x="-15" y="18" width="30" height="7"  rx="3" fill="#2f5f80"/>
          <rect x="-13" y="25" width="26" height="74" rx="4" fill="url(#argoBody)"/>
          <rect x="-13" y="52" width="26" height="6" fill="#8a5a10" opacity=".45"/>
          <rect x="-11" y="99" width="22" height="28" rx="3" fill="#2f5f80"/>
          <circle cy="131" r="5" fill="#f2fbff"/>
          <g id="pings" fill="none" stroke="#7fe8ff" stroke-linecap="round" stroke-width="3">
            <path d="M-20 144 A 26 22 0 0 0 20 144" opacity=".9"/>
            <path d="M-30 152 A 38 30 0 0 0 30 152" opacity=".6"/>
            <path d="M-40 160 A 50 38 0 0 0 40 160" opacity=".32"/>
          </g>
        </g>
      </g>

      <!-- 15 · surface marker -->
      <g id="surfaceTag" class="anim">
        <path d="M0 0 H 52" stroke="#eaf9ff" stroke-width="3" stroke-linecap="round"/>
        <text x="66" y="6" fill="#eaf9ff" font-family="Public Sans, sans-serif"
              font-size="24" font-weight="500" letter-spacing="1">0 m · sea surface</text>
      </g>

    </svg>

    <!-- overlay -->
    <div class="ocean-hud">
      <div class="depth-readout" id="readout" style="opacity:0">
        <div class="value"><b id="depthNum">0</b><span>m</span></div>
        <div class="tag" id="depthTag">float descending</div>
      </div>



      <div class="hint" id="hint">
        <svg class="hint-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="4" x2="12" y2="20"></line>
          <polyline points="18 14 12 20 6 14"></polyline>
        </svg>
        Scroll to know
      </div>
    </div>


      <div class="story-layer" aria-live="polite">
        <header class="ocean-nav">
          <button class="brand" data-depth="0" aria-label="OceanEmbed home">
            <img src="/oceanembed-logo-v2.png" alt="OceanEmbed Logo" style="height: 48px; width: auto; mix-blend-mode: screen;" />
          </button>
          <nav aria-label="Primary navigation">
            <button data-depth="0" data-href="/">EXPLORER</button>
            <button data-depth="367" data-href="/solution">SOLUTION</button>
            <button data-depth="433" data-href="/intelligence">INTELLIGENCE</button>
            <button data-depth="433" data-href="/technology">MODELS</button>
            <button data-depth="567" data-href="/data">ABOUT US</button>
          </nav>
          <div class="nav-depth"><span></span><b>000m</b></div>
        </header>

        <div class="story-copy">
          <article class="story-panel story-hero on" data-from="0" data-to="120">
            <span class="eyebrow">OCEAN DATA PLATFORM · SIH 2026</span>
            <h1 id="heroH1">
              <span id="titleOcean" style="display:inline-block; transform-origin: left top;">OCEAN</span><br/>
              <span id="titleEmbed" style="display:inline-block; transform-origin: left top;"><em>EMBED</em></span>
            </h1>
            <p>Connecting ocean observations and data to make what lies beneath easier to explore and understand.</p>
            <div class="scroll-cue"><i></i> SCROLL TO EXPLORE</div>
          </article>

          <article class="story-panel problem-panel" data-from="100" data-to="168">
            <span class="eyebrow">THE PROBLEM</span>
            <h2>THE OCEAN IS MORE<br><em>THAN ITS SURFACE.</em></h2>
            <div class="problem-stack">
              <p>Satellites continuously observe the ocean surface and provide valuable information about large-scale physical conditions.</p>
              <p class="accent"><strong>But the surface does not tell the whole story.</strong></p>
            </div>
          </article>

          <article class="story-panel problem-panel" data-from="168" data-to="236">
            <span class="eyebrow">BENEATH THE SURFACE</span>
            <h2>WHAT LIES BELOW<br><em>REMAINS HIDDEN.</em></h2>
            <div class="problem-stack">
              <p>Subsurface temperature reveals how heat is distributed through the water column and helps us understand the changing state of the ocean.</p>
              <p class="accent"><strong>Yet direct measurements become increasingly sparse with depth.</strong></p>
            </div>
          </article>

          <article class="story-panel problem-panel" data-from="236" data-to="304">
            <span class="eyebrow">THE DATA GAP</span>
            <h2>SURFACE DATA IS ABUNDANT.<br><em>DEPTH DATA IS NOT.</em></h2>
            <div class="problem-stack">
              <p>Satellites provide broad and continuous observations at the surface, while subsurface observations depend on instruments and measurements distributed across the ocean.</p>
              <p class="accent"><strong>The result is an uneven picture of what is happening beneath the surface.</strong></p>
            </div>
          </article>

          <article class="story-panel problem-panel" data-from="304" data-to="372">
            <span class="eyebrow">THE CHALLENGE</span>
            <h2>CAN SURFACE SIGNALS<br><em>REVEAL THE DEPTHS?</em></h2>
            <div class="problem-stack">
              <p>OceanEmbed explores whether observable ocean conditions can be used to reconstruct information about the subsurface ocean.</p>
              <p class="accent"><strong>This is the gap we aim to bridge.</strong></p>
            </div>
          </article>

          <article class="story-panel solution-panel" data-from="372" data-to="440">
            <span class="eyebrow">SOLUTION · DATASET</span>
            <h2>BUILD THE<br><em>OCEAN DATASET.</em></h2>
            <div class="problem-stack">
              <p>We begin with ocean data that represents conditions across locations and depths.</p>
              <p class="accent"><strong>GLORYS provides the foundation for learning the relationship between surface and subsurface conditions.</strong></p>
            </div>
          </article>

          <article class="story-panel solution-panel" data-from="440" data-to="508">
            <span class="eyebrow">SOLUTION · MODEL</span>
            <h2>TRAIN<br><em>THE MODEL.</em></h2>
            <div class="problem-stack">
              <p>The model learns patterns connecting observable ocean conditions with variables beneath the surface.</p>
              <p class="accent"><strong>Temperature · Height · Depth</strong></p>
              <p>Training across many locations allows the model to learn relationships that are difficult to observe directly everywhere.</p>
            </div>
          </article>

          <article class="story-panel solution-panel" data-from="508" data-to="576">
            <span class="eyebrow">SOLUTION · RECONSTRUCTION</span>
            <h2>RECONSTRUCT<br><em>THE HIDDEN OCEAN.</em></h2>
            <div class="problem-stack">
              <p>Once trained, the model can estimate subsurface conditions from available ocean observations.</p>
              <p class="accent"><strong>From what we can observe<br>to what we cannot directly see.</strong></p>
            </div>
          </article>

          <article class="story-panel impact-panel" data-from="576" data-to="644">
            <span class="eyebrow">VALIDATION</span>
            <h2>TEST AGAINST<br><em>REAL OBSERVATIONS.</em></h2>
            <div class="problem-stack">
              <p>Predictions need to be tested against observations that were not used simply as model outputs.</p>
              <p class="accent"><strong>ARGO FLOATS PROVIDE AN IMPORTANT REFERENCE.</strong></p>
              <p>Their measurements through the water column allow us to compare reconstructed conditions with observed ocean conditions.</p>
            </div>
          </article>

          <article class="story-panel impact-panel" data-from="644" data-to="712">
            <span class="eyebrow">VALIDATION · ERROR</span>
            <h2>MEASURE<br><em>THE ERROR.</em></h2>
            <div class="problem-stack">
              <p>We evaluate how closely the reconstructed ocean matches the observations.</p>
              <p class="accent"><strong>RMSE<br>BIAS<br>CORRELATION</strong></p>
              <p>Together, these metrics help describe the accuracy, systematic error, and ability of the model to capture observed patterns.</p>
            </div>
          </article>

          <article class="story-panel impact-panel" data-from="712" data-to="780">
            <span class="eyebrow">ITERATION</span>
            <h2>LEARN. COMPARE.<br><em>IMPROVE.</em></h2>
            <div class="problem-stack">
              <p>Model evaluation is not the final step. Prediction errors reveal where the reconstruction can be improved.</p>
              <p class="accent"><strong>PREDICT → COMPARE → MEASURE → IMPROVE</strong></p>
              <p>Repeated training and validation help us understand the strengths and limitations of the approach.</p>
            </div>
          </article>

          <article class="story-panel final-panel" data-from="780" data-to="848">
            <span class="eyebrow">THE FINAL VISION</span>
            <h2>FROM SCATTERED<br>OBSERVATIONS TO A<br><em>CLEARER VIEW<br>OF THE OCEAN.</em></h2>
            <div class="problem-stack">
              <p>OceanEmbed aims to make subsurface ocean information easier to explore across locations where direct measurements are limited.</p>
              <p class="accent"><strong>Observe the surface.<br>Learn the hidden patterns.<br>Reconstruct the depths.</strong></p>
            </div>
          </article>

          <article class="story-panel impact-panel calendar-promo-panel" data-from="848" data-to="1001">
            <span class="eyebrow">TRY IT YOURSELF</span>
            <h2>SEE THE VALIDATION,<br><em>LIVE.</em></h2>
            <div class="problem-stack">
              <p>Our Recent Validation Calendar: pick any recent date, see the real Argo floats that reported that day.</p>
              <p class="accent"><strong>Compare them directly against our model's real prediction.</strong></p>
            </div>
            <a class="calendar-promo-cta" href="/solution?openCalendar=1">TRY THE VALIDATION CALENDAR &rarr;</a>
          </article>
        </div>
      </div>
  </div>
</section>
`;

const STYLES = `
/* ══════════════════════════════════════════════════════════════
   1. LAYOUT
   The scroll-track is tall and empty. The stage inside it is
   sticky, so it stays glued to the screen while you scroll past
   the track's height. That scrolled distance becomes "progress".
   ══════════════════════════════════════════════════════════════ */

*, *::before, *::after { box-sizing: border-box; }

html { scroll-behavior: auto; }

body {
  margin: 0;
  background: #02101f;
  font-family: "Public Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Total scroll distance for the whole sequence. Raise for a slower,
   more cinematic feel; lower for a snappier one. */
.ocean-track {
  position: relative;
  height: 5500vh;
}

.ocean-stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100svh;          /* avoids mobile browser-chrome jump */
  overflow: hidden;
}

.ocean-scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

/* Groups we animate. transform-box makes CSS transforms use the
   SVG's own coordinate units, so 1px here == 1 viewBox unit. */
.ocean-scene .anim {
  transform-box: view-box;
  transform-origin: 0 0;
  will-change: transform;
}

/* ══════════════════════════════════════════════════════════════
   2. HTML OVERLAY (crisper text than SVG <text> at small sizes)
   ══════════════════════════════════════════════════════════════ */

.ocean-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: #eaf7ff;
}

/* Live depth counter — JS positions this to track the float. */
.depth-readout {
  position: absolute;
  transform: translate(-100%, -50%);
  text-align: right;
  white-space: nowrap;
  will-change: transform, opacity;
}
.depth-readout .value {
  font-family: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
  letter-spacing: .01em;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 10px rgba(2,20,40,.65);
}
.depth-readout .value span {
  font-size: 0.82em;
  font-weight: 500;
  margin-left: 0.15em;
  opacity: .7;
}
.depth-readout .tag {
  margin-top: .25rem;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: .03em;
  color: #7ce0d0;
  text-shadow: 0 1px 10px rgba(2,20,40,.65);
}

/* Scroll hint. */
.hint {
  position: absolute;
  left: 50%;
  bottom: 2.2rem;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: .6rem;
  font-size: .8rem;
  letter-spacing: .05em;
  color: #cdeafb;
  transition: opacity .4s ease;
}
.hint-arrow {
  display: block;
  animation: drop 1.5s ease-in-out infinite;
}
@keyframes drop {
  0%, 100% { transform: translateY(-4px); opacity: 0.5; }
  50%      { transform: translateY(4px);  opacity: 1; }
}

/* Marine snow drift. */
.flake { animation: sink linear infinite; }
@keyframes sink {
  from { transform: translateY(-140px); }
  to   { transform: translateY(1040px); }
}

/* Atmospheric Clouds */
@keyframes cloudDrift1 { from { transform: translateX(-200px); } to { transform: translateX(1800px); } }
@keyframes cloudDrift2 { from { transform: translateX(200px); } to { transform: translateX(2000px); } }
@keyframes cloudDrift3 { from { transform: translateX(-400px); } to { transform: translateX(1600px); } }
@keyframes cloudDrift4 { from { transform: translateX(100px); } to { transform: translateX(1900px); } }

.cloud-move-1 { animation: cloudDrift1 140s linear infinite; }
.cloud-move-2 { animation: cloudDrift2 210s linear infinite; }
.cloud-move-3 { animation: cloudDrift3 110s linear infinite; }
.cloud-move-4 { animation: cloudDrift4 180s linear infinite; }

/* ---- Marine Life Animations ---- */
.marine-moving-slow { animation: currentDrift 3s ease-in-out infinite alternate; }
.marine-swimming { transform: translateX(-200px); animation: swimRight 45s linear infinite; }
.marine-swimming-slow { transform: translateX(-400px); animation: swimLeft 80s linear infinite; }
.marine-swimming-slowest { transform: translateX(-200px); animation: swimRight 150s linear infinite; }
.marine-bobbing { animation: gentleBob 5s ease-in-out infinite alternate; }
.jelly-float-1 { animation: jellyPulse 12s ease-in-out infinite alternate; }
.jelly-float-2 { animation: jellyPulse 16s ease-in-out infinite alternate-reverse; }
.tentacles-sway path { animation: swayFlow 4s ease-in-out infinite alternate; transform-origin: top; }
.tentacles-sway path:nth-child(even) { animation-delay: -2s; animation-direction: alternate-reverse; }
.kelp-sway path { animation: kelpFlow 6s ease-in-out infinite alternate; transform-origin: bottom; }
.kelp-sway-alt path { animation: kelpFlow 7s ease-in-out infinite alternate-reverse; transform-origin: bottom; }

@keyframes jellyPulse { 0% { transform: translateY(0px) scaleY(1); } 50% { transform: translateY(-30px) scaleY(1.05); } 100% { transform: translateY(-10px) scaleY(0.95); } }
@keyframes currentDrift { from { transform: translateX(-6px) translateY(0); } to { transform: translateX(6px) translateY(-3px); } }
@keyframes gentleBob { from { transform: translateY(-8px); } to { transform: translateY(8px); } }
@keyframes swimRight { from { transform: translateX(-400px) translateY(0); } to { transform: translateX(2000px) translateY(-20px); } }
@keyframes swimLeft { from { transform: translateX(2000px) translateY(0); } to { transform: translateX(-400px) translateY(50px); } }
@keyframes swayFlow { from { transform: skewX(-5deg); } to { transform: skewX(5deg); } }
@keyframes kelpFlow { from { transform: skewX(-4deg) rotate(-2deg); } to { transform: skewX(4deg) rotate(2deg); } }

/* ══════════════════════════════════════════════════════════════
   OCEAN EMBED STORY UI
   Content is intentionally layered over the existing scene.
   ══════════════════════════════════════════════════════════════ */
.story-layer {
  position:absolute;
  inset:0;
  z-index:20;
  pointer-events:none;
}

.ocean-nav {
  position:fixed;
  inset:var(--tsb-height, 0px) 0 auto 0;
  height:70px;
  padding:0 clamp(1rem,4vw,4rem);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:2rem;
  pointer-events:auto;
  color:#eefaff;
  z-index:30;
  transition:transform .45s ease-out;
}
.ocean-nav.hidden {
  transform:translateY(-100%);
}
.brand {
  border:0;
  background:none;
  color:inherit;
  display:flex;
  align-items:center;
  gap:.7rem;
  font:700 .82rem/1 "Bricolage Grotesque",sans-serif;
  letter-spacing:.08em;
  cursor:pointer;
}
.brand > span:last-child span {
  display:block;
  font-weight:500;
  opacity:.62;
  font-size:.66rem;
  letter-spacing:.18em;
  margin-top:.18rem;
}
.brand-mark {
  display:grid;
  place-items:center;
  width:34px;
  height:34px;
  border:1px solid rgba(234,247,255,.42);
  border-radius:50%;
  font-size:.64rem;
  letter-spacing:0;
}
.ocean-nav nav {
  display:flex;
  align-items:center;
  gap:clamp(1rem,2.5vw,2.4rem);
}
.ocean-nav nav button,.footer-links button {
  border:0;
  background:none;
  color:inherit;
  font:600 .68rem/1 "Public Sans",sans-serif;
  letter-spacing:.12em;
  cursor:pointer;
  opacity:.72;
  position:relative;
  padding:.5rem 0;
}
.ocean-nav nav button::after {
  content:"";
  position:absolute;
  left:0;
  right:100%;
  bottom:0;
  height:1px;
  background:#7ce0d0;
  transition:right .3s ease;
}
.ocean-nav nav button:hover,.ocean-nav nav button.active { opacity:1; }
.ocean-nav nav button:hover::after,.ocean-nav nav button.active::after { right:0; }
.nav-depth {
  display:flex;
  align-items:baseline;
  gap:.55rem;
  min-width:66px;
  justify-content:flex-end;
  font-size:.62rem;
  letter-spacing:.08em;
  opacity:.75;
}
.nav-depth span {
  width:5px;
  height:5px;
  border-radius:50%;
  background:#7ce0d0;
  box-shadow:0 0 14px #7ce0d0;
}
.nav-depth b {
  font:600 .72rem "Bricolage Grotesque",sans-serif;
  font-variant-numeric:tabular-nums;
}

.story-copy {
  position:absolute;
  inset:0;
  isolation:isolate;
}

.story-copy::before {
  content:"";
  position:absolute;
  inset:0 auto 0 0;
  width:min(62vw,980px);
  background:linear-gradient(90deg,rgba(1,16,31,.24),rgba(1,16,31,.08) 58%,transparent);
  pointer-events:none;
  z-index:0;
}

/* Keep the story in a dedicated left reading zone. The right side is
   deliberately reserved for the boat, ARGO, tether and depth ruler. */
.story-panel {
  position:absolute;
  left:clamp(1.2rem,6vw,6.5rem);
  top:var(--panel-offset, 50%);
  width:min(560px,43vw);
  max-height:72vh;
  transform:translate3d(0,calc(var(--panel-offset, 0%) + 6%),18px);
  opacity:0;
  transition:opacity .5s cubic-bezier(.2,.8,.2,1),transform .65s cubic-bezier(.2,.8,.2,1);
  z-index:2;
}
.story-panel.on {
  opacity:1;
  transform:translate3d(0,-50%,0);
}
.story-hero {
  top: 50% !important;
}
.eyebrow {
  display:block;
  margin-bottom:1.1rem;
  color:#8de3d4;
  font:600 .63rem/1.4 "Public Sans",sans-serif;
  letter-spacing:.17em;
}
.story-panel h1,.story-panel h2 {
  margin:0;
  color:#f1fbff;
  font-family:var(--font-space-grotesk), "Bricolage Grotesque", sans-serif;
  font-weight:700;
  letter-spacing:-.02em;
  line-height:.88;
}
.story-panel h1 { font-size:clamp(4rem,8vw,8rem); line-height:0.75; }
.story-panel h2 { font-size:clamp(3rem,5.6vw,6rem); }
.story-panel em {
  font-style:normal;
  color:transparent;
  -webkit-text-stroke:1px rgba(241,251,255,.8);
}
.story-panel p {
  max-width:44ch;
  margin:1.5rem 0 0;
  color:#d6effc;
  font-size:clamp(.92rem,1.15vw,1.08rem);
  line-height:1.65;
}
.scroll-cue {
  display:flex;
  align-items:center;
  gap:.7rem;
  margin-top:2rem;
  font-size:.64rem;
  letter-spacing:.15em;
  color:#dff5ff;
}
.scroll-cue i {
  width:28px;
  height:1px;
  background:#dff5ff;
  position:relative;
}
.scroll-cue i::after {
  content:"";
  position:absolute;
  right:0;
  top:-2px;
  width:5px;
  height:5px;
  border-right:1px solid;
  border-top:1px solid;
  transform:rotate(45deg);
}

.problem-panel {
  width:min(530px,42vw);
}
.problem-panel::after {
  content:"";
  position:absolute;
  inset:-70px -90px -70px -34px;
  z-index:-1;
  background:transparent;
  pointer-events:none;
}
.problem-stack {
  margin-top:1.6rem;
  border-left:1px solid rgba(141,227,212,.45);
  padding-left:1.2rem;
}
.problem-stack p { margin:.65rem 0; }
.problem-stack .accent { color:#eefaff; font-size:1rem; }
.problem-stack strong { color:#8de3d4; font-weight:600; }

.solution-panel {
  width:min(590px,43vw);
}
.pipeline {
  margin-top:2rem;
  width:min(510px,100%);
  display:grid;
  grid-template-columns:1fr;
  gap:.42rem;
  color:#dff5ff;
}
.pipeline span {
  display:flex;
  align-items:center;
  min-height:36px;
  padding:.58rem .75rem;
  border:1px solid rgba(223,245,255,.18);
  background:rgba(2,20,40,.30);
  backdrop-filter:blur(8px);
  font:600 .61rem "Public Sans",sans-serif;
  letter-spacing:.08em;
  transition:transform .3s,border-color .3s,background .3s;
}
.pipeline span::before {
  content:"";
  width:5px;
  height:5px;
  border-radius:50%;
  margin-right:.7rem;
  background:#7ce0d0;
  box-shadow:0 0 12px rgba(124,224,208,.55);
}
.pipeline i {
  display:block;
  width:1px;
  height:10px;
  margin-left:1rem;
  background:linear-gradient(#7ce0d0,transparent);
  position:relative;
}
.pipeline i::after {
  content:"";
  position:absolute;
  bottom:0;
  left:-2px;
  border:3px solid transparent;
  border-bottom:0;
  border-top-color:#7ce0d0;
}
.pipeline span:hover {
  transform:translateX(6px);
  border-color:#7ce0d0;
  background:rgba(2,30,50,.52);
}

.data-panel {
  width:min(600px,43vw);
}
.data-panel h2 { margin-bottom:1.35rem; }
.data-grid {
  display:grid;
  grid-template-columns:1fr;
  gap:10px;
}
.info-card {
  width:100%;
  min-height:0;
  text-align:left;
  padding:1rem 1.1rem;
  border:1px solid rgba(223,245,255,.16);
  background:linear-gradient(135deg,rgba(3,28,51,.62),rgba(3,13,27,.42));
  color:#eaf7ff;
  backdrop-filter:blur(12px);
  cursor:pointer;
  transition:transform .45s cubic-bezier(.2,.8,.2,1),border-color .3s,box-shadow .3s;
}
.info-card:hover {
  transform:translateX(8px);
  border-color:rgba(124,224,208,.7);
  box-shadow:0 18px 45px rgba(0,0,0,.24);
}
.info-card small {
  display:block;
  color:#8de3d4;
  font-size:.55rem;
  letter-spacing:.13em;
  margin-bottom:.45rem;
}
.info-card strong {
  display:block;
  font:700 1.35rem "Bricolage Grotesque",sans-serif;
  letter-spacing:-.03em;
}
.info-card span {
  display:block;
  margin-top:.4rem;
  color:#c9e6f3;
  font-size:.68rem;
  line-height:1.48;
  max-width:58ch;
}
.info-card b {
  display:block;
  margin-top:.7rem;
  font-size:.55rem;
  letter-spacing:.13em;
  opacity:.65;
}

.impact-panel { width:min(590px,43vw); }
/* Pinned to mid-screen (like the title panel) so it doesn't ride upward with the fast-rising seabed and collide with the nav. */
.calendar-promo-panel { pointer-events:none; top:50% !important; }
.calendar-promo-panel.on { pointer-events:auto; }
.calendar-promo-cta {
  display:inline-block;
  margin-top:1.6rem;
  padding:.8rem 1.3rem;
  background:rgba(124,224,208,.12);
  border:1px solid #7ce0d0;
  border-radius:3px;
  color:#eefaff;
  font:600 .72rem/1 "Public Sans",sans-serif;
  letter-spacing:.06em;
  text-decoration:none;
  transition:background .2s ease,transform .2s ease;
}
.calendar-promo-cta:hover { background:rgba(124,224,208,.25); transform:translateY(-1px); }
.impact-flow {
  margin-top:1.8rem;
  width:min(500px,100%);
}
.impact-flow span {
  display:block;
  padding:.68rem 0;
  border-bottom:1px solid rgba(223,245,255,.16);
  color:#d9effa;
  font:600 .7rem "Public Sans",sans-serif;
  letter-spacing:.12em;
}
@keyframes kelp-drift {
  0%   { transform: skewX(-3deg) rotate(-1deg); }
  50%  { transform: skewX(4deg) rotate(2deg); }
  100% { transform: skewX(-3deg) rotate(-1deg); }
}
@keyframes gentle-sway {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(2deg); }
}
.impact-flow i {
  display:block;
  color:#7ce0d0;
  font-style:normal;
  font-size:.7rem;
  margin:.12rem 0;
}
.impact-flow .final-flow {
  color:#8de3d4;
  border-bottom-color:rgba(141,227,212,.5);
}

.final-panel {
  left:clamp(1.2rem,6vw,6.5rem);
  top:50%;
  width:min(650px,48vw);
  text-align:left;
  transform:translate3d(0,-42%,18px) scale(.97);
}
.final-panel.on { transform:translate3d(0,-50%,0) scale(1); }
.final-depth {
  display:block;
  font:700 clamp(3rem,7vw,6.5rem) "Bricolage Grotesque",sans-serif;
  color:#eefaff;
  letter-spacing:-.06em;
  opacity:.18;
}
.final-panel p {
  margin:.5rem 0 .7rem;
  font-size:.7rem;
  letter-spacing:.25em;
  color:#8de3d4;
}
.final-panel h2 { font-size:clamp(2.6rem,5vw,5.2rem); }
.final-panel > strong {
  display:block;
  margin-top:2rem;
  font:700 .85rem "Bricolage Grotesque",sans-serif;
  letter-spacing:.18em;
}
.final-panel > span:last-child {
  display:block;
  margin-top:.45rem;
  color:#9bc5d7;
  font-size:.72rem;
}

.site-footer { position:relative; min-height:55vh; background:#010b16; color:#eaf7ff; border-top:1px solid rgba(223,245,255,.1); padding:clamp(4rem,9vw,8rem) clamp(1.2rem,7vw,7rem); }
.footer-inner { max-width:1280px; margin:auto; }
.footer-kicker { color:#7ce0d0; font:600 .62rem "Public Sans",sans-serif; letter-spacing:.18em; }
.footer-inner h2 { margin:1rem 0 4rem; font:700 clamp(2.6rem,6vw,6rem)/.9 "Bricolage Grotesque",sans-serif; letter-spacing:-.06em; max-width:700px; }
.footer-links { display:flex; flex-wrap:wrap; gap:1.5rem 2.4rem; border-top:1px solid rgba(223,245,255,.15); padding-top:1.4rem; }
.footer-links button:hover { color:#8de3d4; transform:translateX(5px); }
.footer-inner > p { margin-top:4rem; color:#7896a7; font-size:.65rem; letter-spacing:.08em; }

@media (max-width:1100px) {
  .story-panel { width:min(500px,46vw); }
  .story-panel h1 { font-size:clamp(3.8rem,8vw,7rem); line-height:0.75; }
  .story-panel h2 { font-size:clamp(2.8rem,5.5vw,5.4rem); }
  .data-panel,.solution-panel,.impact-panel { width:min(520px,46vw); }
  .nav-depth { display:none; }
}
@media (max-width:900px) {
  .ocean-nav nav { gap:1rem; }
  .story-panel,.problem-panel,.solution-panel,.data-panel,.impact-panel,.final-panel {
    width:min(560px,54vw);
  }
  .info-card span { max-width:52ch; }
}
@media (max-width:700px) {
  .ocean-nav { height:64px; }
  .ocean-nav nav button:nth-child(n+3) { display:none; }
  .story-panel,.problem-panel,.solution-panel,.data-panel,.impact-panel,.final-panel {
    left:1.2rem;
    right:1.2rem;
    width:auto;
    max-height:68vh;
    transform:translate3d(0,-44%,18px);
  }
  .story-panel.on,.problem-panel.on,.solution-panel.on,.data-panel.on,.impact-panel.on,.final-panel.on {
    transform:translate3d(0,-50%,0);
  }
  .story-panel h1 { font-size:clamp(3.4rem,18vw,5.8rem); line-height:0.75; }
  .story-panel h2 { font-size:clamp(2.5rem,12vw,4.2rem); }
  .story-panel p { font-size:.88rem; }
  .pipeline { max-height:40vh; overflow:auto; padding-right:.25rem; }
  .data-grid { max-height:44vh; overflow:auto; padding-right:.25rem; }
  .info-card span { font-size:.66rem; }
  .site-footer { min-height:65vh; }
}

/* ══════════════════════════════════════════════════════════════
   3. ACCESSIBILITY — respect a reduced-motion preference
   ══════════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  .flake, .hint i { animation: none !important; }
}

`;

export default function OceanHero() {
  const rootRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    function initOceanHero() {

      /* ══════════════════════════════════════════════════════════════
         TUNING — every number worth changing lives here.
         ══════════════════════════════════════════════════════════════ */
      const CFG = {
        maxDepth: 1000,   // metres at the end of the scroll (was 1200; reduced to make room for the calendar-promo panel — all depth-keyed thresholds below are scaled by the same 5/6 factor)
        pxPerMetre: 2.6,    // ruler spacing, in viewBox units
        restEnd: 0.0,   // p: intro holds until here (now animates immediately)
        moveEnd: 0.18,  // p: boat stops sliding right, float starts diving
        ease: 0.16,  // damping. lower = smoother + laggier
      };
      // Horizontal and vertical placement live in FX / FY further down —
      // they're fractions of the visible area, not fixed coordinates.

      const $ = id => document.getElementById(id);
      const scene = $('scene'), track = $('track');
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

      /* ── helpers ─────────────────────────────────────────────────── */
      const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
      const lerp = (a, b, t) => a + (b - a) * t;
      // map v from [i0,i1] onto [o0,o1], clamped
      const map = (v, i0, i1, o0, o1) => lerp(o0, o1, clamp((v - i0) / (i1 - i0)));
      // smoothstep: eases in and out, so nothing starts or stops abruptly
      const ease = t => (t = clamp(t), t * t * (3 - 2 * t));
      const mapE = (v, i0, i1, o0, o1) => lerp(o0, o1, ease((v - i0) / (i1 - i0)));

      /* ── water colour ramp, keyed to depth ───────────────────────── */
      const RAMP = [
        { d: 0, top: [41, 182, 239], bot: [13, 116, 181] },
        { d: 120, top: [31, 158, 222], bot: [10, 92, 154] },
        { d: 320, top: [15, 107, 168], bot: [6, 74, 128] },
        { d: 620, top: [7, 63, 110], bot: [3, 42, 78] },
        { d: 1000, top: [4, 34, 61], bot: [1, 13, 28] },
      ];
      function waterAt(d) {
        let i = 0;
        while (i < RAMP.length - 2 && d > RAMP[i + 1].d) i++;
        const a = RAMP[i], b = RAMP[i + 1];
        const t = clamp((d - a.d) / (b.d - a.d));
        const mix = k => `rgb(${Math.round(lerp(a[k][0], b[k][0], t))},${Math.round(lerp(a[k][1], b[k][1], t))},${Math.round(lerp(a[k][2], b[k][2], t))})`;
        return [mix('top'), mix('bot')];
      }

      /* ── build the depth ruler once ──────────────────────────────── */
      (function buildRuler() {
        const g = $('ruler');
        const NS = 'http://www.w3.org/2000/svg';
        let markup = '';
        for (let d = 0; d <= CFG.maxDepth; d += 50) {
          const y = d * CFG.pxPerMetre;
          const major = d % 100 === 0;
          markup += `<path d="M ${major ? 316 : 340} ${y} H 372"
                 stroke="#cfeeff" stroke-opacity="${major ? .55 : .25}"
                 stroke-width="${major ? 2.5 : 2}" stroke-linecap="round"/>`;
          if (major) markup += `<text x="300" y="${y + 6}" text-anchor="end"
                 fill="#cfeeff" fill-opacity=".72" font-family="Public Sans, sans-serif"
                 font-size="17" font-weight="500">${d}</text>`;
        }
        g.innerHTML = markup;
      })();

      /* ── build marine snow once ──────────────────────────────────── */
      (function buildSnow() {
        const g = $('snow');
        let markup = '';
        for (let i = 0; i < 64; i++) {
          const x = Math.random() * 1520 - 40;
          const r = 1.1 + Math.random() * 2.4;
          const dur = 16 + Math.random() * 22;
          const del = -Math.random() * dur;
          markup += `<circle class="flake" cx="${x.toFixed(1)}" cy="0" r="${r.toFixed(1)}"
                 fill="#dff3ff" fill-opacity="${(0.18 + Math.random() * 0.42).toFixed(2)}"
                 style="animation-duration:${dur.toFixed(1)}s;animation-delay:${del.toFixed(1)}s"/>`;
        }
        g.innerHTML = markup;
      })();

      /* ── cached nodes ────────────────────────────────────────────── */
      const N = {
        glow: $('glow'), sun: $('sun'), clouds: $('clouds'), waterWrap: $('waterWrap'), rays: $('rays'), deepFade: $('deepFade'),
        snow: $('snow'), ruler: $('ruler'), guide: $('guide'), wire: $('wire'),
        boat: $('boat'), waves: $('waves'), sat: $('sat'), beam: $('beam'),
        packets: [...$('packets').children], argo: $('argo'), pings: $('pings'),
        clipRect: $('clipRect'), skyDim: $('skyDim'), argoHalo: $('argoHalo'),
        surfaceTag: $('surfaceTag'), readout: $('readout'), depthNum: $('depthNum'),
        depthTag: $('depthTag'), hint: $('hint'),
        marineFish: $('marineFish'), marineShark: $('marineShark'), marineWhale: $('marineWhale'), marineOcto: $('marineOcto'), marineBed: $('marineBed'),
        wTop: $('wTop'), wBot: $('wBot'),
        storyPanels: [...document.querySelectorAll('.story-panel')],
        nav: document.querySelector('.ocean-nav'),
        navButtons: [...document.querySelectorAll('.ocean-nav nav button')],
        navDepth: document.querySelector('.nav-depth b'),
        brand: document.querySelector('.brand'),
        footerButtons: [...document.querySelectorAll('.footer-links button')],
        storyHeroPanel: document.querySelector('.story-hero'),
        heroTitle: document.querySelector('.story-hero h1'),
        titleOcean: document.getElementById('titleOcean'),
        titleEmbed: document.getElementById('titleEmbed'),
        heroEyebrow: document.querySelector('.story-hero .eyebrow'),
        heroDesc: document.querySelector('.story-hero p'),
        heroCTA: document.querySelector('.story-hero .scroll-cue'),
      };

      /* ── scroll progress: raw target, then a damped follower ─────── */
      let target = 0, cur = 0, last = performance.now();
      let lastScrollY = window.scrollY;

      function readScroll() {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
          N.nav.classList.add('hidden');
        } else {
          N.nav.classList.remove('hidden');
        }
        lastScrollY = currentScrollY;

        const r = track.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        target = span > 0 ? clamp(-r.top / span) : 0;
      }
      const onResize = () => { readScroll(); measure(); };
      addEventListener('scroll', readScroll, { passive: true });
      addEventListener('resize', onResize, { passive: true });
      let alive = true;

      /* viewBox → screen px for the "slice" fit, plus the slice of the
         viewBox actually visible. Because "slice" crops the sides on tall
         screens, fixed x-coordinates would fall off a phone. Everything
         horizontal is therefore placed as a FRACTION of the visible band. */
      let fit = { s: 1, ox: 0, oy: 0 };
      let band = { left: 0, w: 1440, top: 0, h: 900 };
      let titleCenterDx = 0;
      let titleCenterDy = 0;
      let maxTitleScale = 1;
      let embedInlineDx = 0;
      let embedInlineDy = 0;
      let finalEmbedLift = 0;
      const FINAL_LINE_GAP_EM = 0.1;

      function measure() {
        const r = scene.getBoundingClientRect();
        const s = Math.max(r.width / 1440, r.height / 900);
        fit = { s, ox: r.width / 2 - 720 * s, oy: r.height / 2 - 450 * s };
        const visW = r.width / s, visH = r.height / s;
        band = { w: visW, left: 720 - visW / 2, h: visH, top: 450 - visH / 2 };

        if (N.storyHeroPanel && N.heroTitle && N.titleOcean && N.titleEmbed) {
          N.heroTitle.style.transform = '';
          N.titleEmbed.style.transform = '';

          const panelRect = N.storyHeroPanel.getBoundingClientRect();

          const gap = N.titleOcean.offsetWidth * 0.15;
          const oceanRect0 = N.titleOcean.getBoundingClientRect();
          const embedRect0 = N.titleEmbed.getBoundingClientRect();
          embedInlineDx = (oceanRect0.right - embedRect0.left) + gap;
          embedInlineDy = oceanRect0.top - embedRect0.top;

          const desiredMaxScale = window.innerWidth < 700 ? 1.15 : 1.5;
          const singleLineW = N.titleOcean.offsetWidth + gap + N.titleEmbed.offsetWidth;
          const safetyMargin = 0.92; // keep ~8% breathing room on each side
          maxTitleScale = Math.min(desiredMaxScale, (window.innerWidth * safetyMargin) / singleLineW);
          const scaledW = singleLineW * maxTitleScale;

          // The Argo float natively rests at exactly 48.6% of the screen width (CFG FX.floatRest = 0.486).
          titleCenterDx = (window.innerWidth * 0.486) - panelRect.left - (scaledW / 2);
          titleCenterDy = Math.min(window.innerHeight * 0.35, 250);
          const oceanRect = N.titleOcean.getBoundingClientRect();
          const embedRect = N.titleEmbed.getBoundingClientRect();
          const naturalGap = embedRect.top - oceanRect.bottom;
          const fontPx = parseFloat(getComputedStyle(N.titleOcean).fontSize) || 0;
          const desiredGap = fontPx * FINAL_LINE_GAP_EM;
          finalEmbedLift = naturalGap - desiredGap;
        }
      }

      // fraction of the visible band → viewBox coordinate
      const X = f => band.left + f * band.w;
      const Y = f => band.top + f * band.h;

      // Boat and float share the same end x, so the tether hangs straight down.
      const FX = {
        boatRest: 0.486, boatEnd: 0.900,
        satRest: 0.181, satEnd: 0.288,
        floatRest: 0.486, floatEnd: 0.900,
        ruler: 0.620, tag: 0.048,
      };
      // vertical placement, as fractions of the visible height
      const FY = { waterRest: 0.48, waterEnd: 0.17, floatRest: 0.62 };

      /* ══════════════════════════════════════════════════════════════
         THE FRAME — every element is a formula of `p`
         ══════════════════════════════════════════════════════════════ */
      function draw(p) {
        const { restEnd: R, moveEnd: M } = CFG;

        /* ---- depth calculation --------------------------------- */
        const depth = p <= M
          ? mapE(p, R, M, 0, 42)
          : map(p, M, 1, 42, CFG.maxDepth);

        /* ---- surface: waterline climbs as we dive -------------- */
        const waterY = p <= M 
          ? mapE(p, R, M, Y(FY.waterRest), Y(FY.waterEnd))
          : map(depth, 750, 958, Y(FY.waterEnd), Y(-0.25));

        /* ---- boat: shrinks and slides to the right ------------- */
        const narrow = band.w < 760;                 // portrait phone
        const bs = mapE(p, R, M, narrow ? 0.92 : 1, narrow ? 0.24 : 0.27);
        const bx = mapE(p, R, M, X(FX.boatRest), X(narrow ? 0.86 : FX.boatEnd));
        const by = waterY;
        N.boat.style.transform = `translate(${bx}px,${by}px) scale(${bs})`;

        /* ---- satellite: shrinks, tucks toward upper-left ------- */
        const ss = mapE(p, R, M, narrow ? 0.75 : 1, narrow ? 0.4 : 0.52);
        const sx = mapE(p, R, M, X(FX.satRest), X(FX.satEnd));
        const sy = mapE(p, R, M, Y(0.17), Y(0.065));
        N.sat.style.transform = `translate(${sx}px,${sy}px) scale(${ss})`;
        N.glow.style.transform = `translate(${sx}px,${sy}px) scale(${ss * 1.05})`;

        /* ---- float: descends, then locks; depth keeps climbing - */
        const fy = mapE(p, R, M, waterY + 130, Y(FY.floatRest));
        const fx = mapE(p, R, M, X(FX.floatRest), X(narrow ? 0.86 : FX.floatEnd));
        const fs = mapE(p, R, M, narrow ? 0.70 : 0.78, narrow ? 0.48 : 0.55);
        N.argo.style.transform = `translate(${fx}px,${fy}px) scale(${fs})`;

        /* ---- floating argo logic ------------------------------- */

        // Abyssal descent opacities
        const surfaceOp = 1 - clamp((depth - 708) / 167);   // Fades down from ~708m to ~875m
        const signalFade = 1 - clamp((depth - 792) / 125);  // Fades down from ~792m to ~917m
        const bedOp = clamp((depth - 792) / 125);           // Grows from ~792m to ~917m
        const animalOp = 1 - clamp((depth - 833) / 167);   // Fades down from ~833m to maxDepth

        /* ---- water body + waves ------------------------------- */
        N.waterWrap.style.transform = `translate(0px,${waterY}px)`;
        // NOTE: N.waterWrap MUST NOT fade opacity, it forms the entire full screen deep ocean background.
        N.waves.style.transform = `translate(0px,${waterY}px)`;
        N.waves.style.opacity = surfaceOp.toFixed(3);
        if (N.sun) N.sun.style.opacity = surfaceOp.toFixed(3);
        if (N.clouds) N.clouds.style.opacity = (surfaceOp * 0.55).toFixed(3);
        N.boat.style.opacity = surfaceOp.toFixed(3);
        N.sat.style.opacity = surfaceOp.toFixed(3);
        N.glow.style.opacity = surfaceOp.toFixed(3);

        N.rays.style.transform = `translate(0px,${waterY}px)`;
        N.clipRect.setAttribute('y', waterY.toFixed(1));
        N.surfaceTag.style.transform = `translate(${X(FX.tag)}px,${(waterY + (narrow ? 54 : -26)).toFixed(1)}px)`;
        N.surfaceTag.style.opacity = String(1 - ease((p - R) / (M - R) * 1.4));

        const [ct, cb] = waterAt(depth);
        N.wTop.setAttribute('stop-color', ct);
        N.wBot.setAttribute('stop-color', cb);

        /* ---- tether: hangs straight down from the hull ------- */
        const hx = bx, hy = by + 30 * bs;
        const tx = fx, ty = fy - 56 * fs;
        N.wire.setAttribute('d', `M ${hx.toFixed(1)} ${hy.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`);
        N.wire.style.opacity = signalFade.toFixed(3);

        /* ---- ruler + guide line ------------------------------- */
        N.ruler.style.transform = `translate(${(X(narrow ? 0.34 : FX.ruler) - 300).toFixed(1)}px,${(fy - depth * CFG.pxPerMetre).toFixed(1)}px)`;
        N.ruler.style.opacity = String(ease((p - R * 0.6) / 0.18));
        N.guide.style.transform = `translate(0px,${fy}px)`;
        N.guide.style.opacity = (ease((p - M) / 0.12) * 0.9 * signalFade).toFixed(3);

        /* ---- depth cues --------------------------------------- */
        N.deepFade.setAttribute('opacity', '0');
        N.skyDim.setAttribute('opacity', clamp(depth / 917).toFixed(3));
        N.argoHalo.setAttribute('opacity', clamp((depth - 100) / 350).toFixed(3));
        N.rays.setAttribute('opacity', ((1 - clamp(depth / 217)) * surfaceOp).toFixed(3));
        N.snow.setAttribute('opacity', clamp((depth - 117) / 183).toFixed(3));
        N.pings.setAttribute('opacity', (0.35 + 0.65 * Math.abs(Math.sin(performance.now() / 900))).toFixed(3));

        /* ---- uplink beam -------------------------------------- */
        const mastX = bx + 51 * bs, mastY = by - 226 * bs;
        N.beam.setAttribute('d', `M ${sx.toFixed(1)} ${(sy + 36 * ss).toFixed(1)} L ${mastX.toFixed(1)} ${mastY.toFixed(1)}`);
        N.beam.style.opacity = signalFade.toFixed(3);
        if (!reduce) {
          N.beam.style.strokeDashoffset = String(-(performance.now() / 26) % 22);
          const len = N.beam.getTotalLength();
          N.packets.forEach((c, i) => {
            const t = ((performance.now() / 2600) + i / 3) % 1;
            const pt = N.beam.getPointAtLength(len * t);
            c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y);
            c.setAttribute('opacity', (Math.sin(t * Math.PI) * 0.95).toFixed(2));
          });
        }

        /* ---- OceanEmbed story layer ---------------------------- */
        const f_water = (waterY - band.top) / band.h;
        const currentBedY = map(depth, 667, 1000, 600, 0);
        const f_bed = (420 + currentBedY - band.top) / band.h;

        const safeTopMargin = window.innerWidth < 700 ? 10 : 14;
        const safeBotMargin = 8;
        
        let safeTopVh = (f_water * 100) + safeTopMargin;
        if (safeTopVh < 10) safeTopVh = 10;
        
        const safeBotVh = Math.min(100, f_bed * 100) - safeBotMargin;

        N.storyPanels.forEach((panel) => {
          const from = +panel.dataset.from, to = +panel.dataset.to;
          const active = depth >= from && depth < to;
          panel.classList.toggle('on', active);

          if (active && !panel.classList.contains('story-hero') && !panel.classList.contains('calendar-promo-panel')) {
            const ph = (panel.offsetHeight / window.innerHeight) * 100;
            // Inject small custom offset exclusively for Data Gap panel
            const isDataGap = from === 236;
            const extraOffset = isDataGap ? (window.innerWidth < 700 ? 6 : 8) : 0;
            
            let center = (safeTopVh + safeBotVh) / 2 + extraOffset;
            center = Math.max(safeTopVh + ph / 2, center);
            center = Math.min(safeBotVh - ph / 2, center);
            panel.style.setProperty('--panel-offset', `${center.toFixed(2)}vh`);
          }
        });
        N.navButtons.forEach((b) => {
          const d = +b.dataset.depth;
          b.classList.toggle('active', Math.abs(depth - d) < 92);
        });
        N.navDepth.textContent = String(Math.round(depth / 10) * 10).padStart(3, '0') + 'm';

        /* ---- HUD ---------------------------------------------- */
        const shown = Math.round(depth / 5) * 5;
        N.depthNum.textContent = shown;
        N.depthTag.textContent = shown >= CFG.maxDepth ? 'profile complete'
          : shown < 10 ? 'at the surface'
            : 'float descending';
        N.readout.style.opacity = String(ease((p - R) / 0.14));
        N.readout.style.left = (fit.ox + (fx - 26) * fit.s) + 'px';
        N.readout.style.top = (fit.oy + fy * fit.s) + 'px';

        N.hint.style.opacity = String(1 - clamp(p / 0.05));

        /* ---- MARINE ECOSYSTEM DYNAMICS ------------------------ */
        if (N.marineFish) {
          const fishY = map(depth, 25, 208, 950, -150);
          N.marineFish.style.transform = `translate(0px,${fishY}px)`;
          N.marineFish.style.opacity = animalOp.toFixed(3);
        }
        if (N.marineShark) {
          const sharkY = map(depth, 125, 417, 950, -150);
          N.marineShark.style.transform = `translate(0px,${sharkY}px)`;
          N.marineShark.style.opacity = animalOp.toFixed(3);
        }
        if (N.marineWhale) {
          const whaleY = map(depth, 333, 625, 1050, -250);
          N.marineWhale.style.transform = `translate(0px,${whaleY}px)`;
          N.marineWhale.style.opacity = animalOp.toFixed(3);
        }
        if (N.marineOcto) {
          const octoY = map(depth, 542, 833, 950, -100);
          N.marineOcto.style.transform = `translate(0px,${octoY}px)`;
          N.marineOcto.style.opacity = animalOp.toFixed(3);
        }
        if (N.marineBed) {
          const bedY = map(depth, 667, 1000, 600, 0);
          N.marineBed.style.transform = `translate(0px,${bedY}px)`;
          N.marineBed.style.opacity = bedOp.toFixed(3);
        }

        /* ---- Cinematic Hero Title Sequence -------------------- */
        if (N.heroTitle) {
          // Title timing driven natively by exact physical depth metrics, guaranteeing the exact 35m trigger flawlessly
          // automatically avoiding desynchronization on wildly expanded track heights.
          const titleP = clamp((depth - 29) / 13);
          const revealP = clamp((depth - 35) / 7);

          const dx = mapE(titleP, 0, 1, titleCenterDx, 0);
          const dy = mapE(titleP, 0, 1, titleCenterDy, 0);
          const sc = mapE(titleP, 0, 1, maxTitleScale, 1);

          N.heroTitle.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sc})`;
          N.heroTitle.style.transformOrigin = 'left top';
          N.heroTitle.style.willChange = 'transform';

          if (N.titleEmbed) {
            const edx = mapE(titleP, 0, 1, embedInlineDx, 0);
            const edy = mapE(titleP, 0, 1, embedInlineDy, -finalEmbedLift);
            N.titleEmbed.style.transform = `translate3d(${edx}px, ${edy}px, 0)`;
          }

          const secO = ease(revealP).toFixed(3);
          const secY = mapE(revealP, 0, 1, 20, 0).toFixed(1);

          if (N.heroEyebrow) { N.heroEyebrow.style.opacity = secO; N.heroEyebrow.style.transform = `translateY(${secY}px)`; }
          if (N.heroDesc) { N.heroDesc.style.opacity = secO; N.heroDesc.style.transform = `translateY(${secY}px)`; }
          if (N.heroCTA) { N.heroCTA.style.opacity = secO; N.heroCTA.style.transform = `translateY(${secY}px)`; }
        }
      }

      /* ══════════════════════════════════════════════════════════════
         LOOP — damped follow makes the scrub feel weighted, not twitchy.
         The pow() keeps the feel identical at 60 Hz and 144 Hz.
         ══════════════════════════════════════════════════════════════ */
      function tick(now) {
        const dt = Math.min(now - last, 50); last = now;
        const k = reduce ? 1 : 1 - Math.pow(1 - CFG.ease, dt / 16.667);
        cur += (target - cur) * k;
        if (Math.abs(target - cur) < 0.00005) cur = target;
        draw(cur);
        if (alive) requestAnimationFrame(tick);
      }

      const jumpToDepth = (d) => {
        const r = track.getBoundingClientRect();
        const span = track.offsetHeight - window.innerHeight;
        const M = CFG.moveEnd;
        const p = d <= 50 ? M * (d / 50) : M + ((d - 50) / (CFG.maxDepth - 50)) * (1 - M);
        window.scrollTo({ top: window.scrollY + r.top + clamp(p) * span, behavior: reduce ? 'auto' : 'smooth' });
      };
      N.navButtons.forEach((b) => b.addEventListener('click', () => {
        const href = b.dataset.href;
        if (href && href !== '/') {
          router.push(href);
        } else {
          jumpToDepth(+b.dataset.depth);
        }
      }));
      N.footerButtons.forEach((b) => b.addEventListener('click', () => {
        window.scrollTo({ top: track.offsetTop + clamp((+b.dataset.footerDepth) / 1000) * (track.offsetHeight - window.innerHeight), behavior: reduce ? 'auto' : 'smooth' });
      }));
      N.brand.addEventListener('click', () => window.scrollTo({ top: track.offsetTop, behavior: reduce ? 'auto' : 'smooth' }));

      measure(); readScroll(); cur = target; draw(cur);
      requestAnimationFrame(tick);
      if (document.fonts) document.fonts.ready.then(() => { measure(); draw(cur); });

      function cleanup() {
        alive = false;
        removeEventListener('scroll', readScroll);
        removeEventListener('resize', onResize);
      }
      return cleanup;
    }

    const cleanup = initOceanHero();
    return cleanup;
  }, []);

  return (
    <div ref={rootRef}>
      <style>{STYLES}</style>
      <div dangerouslySetInnerHTML={{ __html: MARKUP }} />
    </div>
  );
}



