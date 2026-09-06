"use client";

import React, { useEffect, useRef } from "react";

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
          <path d="M0,0 Q10,-5 20,0 Q10,5 0,0Z M5,-2 L10,0 L10,-4Z M15,-10 Q25,-15 35,-10 Q25,-5 15,-10Z M20,-12 L25,-10 L25,-14Z M30,10 Q40,5 50,10 Q40,15 30,10Z M35,8 L40,10 L40,6Z M55,-5 Q65,-10 75,-5 Q65,0 55,-5Z M60,-7 L65,-5 L65,-9Z M-20,15 Q-10,10 0,15 Q-10,20 -20,15Z M-15,13 L-10,15 L-10,11Z" fill="currentColor"/>
        </symbol>
        <symbol id="school2" overflow="visible">
          <path d="M0,0 Q10,-3 15,0 Q10,3 0,0Z M3,-1 L8,0 L8,-2Z M30,-15 Q40,-18 45,-15 Q40,-12 30,-15Z M33,-16 L38,-15 L38,-17Z M-15,-25 Q-5,-28 0,-25 Q-5,-22 -15,-25Z M-12,-26 L-7,-25 L-7,-27Z M40,20 Q50,17 55,20 Q50,23 40,20Z M43,19 L48,20 L48,18Z" fill="currentColor"/>
        </symbol>
        <symbol id="ray" overflow="visible">
          <path d="M0,0 C30,-30 60,-30 90,0 C60,10 30,10 0,0Z M15,0 C30,-40 60,-40 75,0 C60,5 30,5 15,0Z M90,0 L130,10 L130,6 Z" fill="currentColor"/>
        </symbol>
        <symbol id="turtle" overflow="visible">
          <path d="M20,0 C30,-15 50,-15 60,0 C50,10 30,10 20,0Z M60,-2 C70,-5 75,0 60,2 Z M30,-4 C50,-20 40,10 30,-4Z M50,-4 C55,-15 45,5 50,-4Z" fill="currentColor"/>
        </symbol>
        <symbol id="jellyfish" overflow="visible">
          <path d="M0,0 C0,-30 40,-30 40,0 Z" fill="currentColor" opacity="0.75"/>
          <path d="M10,0 Q15,20 10,40 M20,0 Q25,25 15,45 M30,0 Q35,30 25,50 M5,0 Q-5,20 5,35 M35,0 Q45,20 35,35" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.45"/>
        </symbol>
        <symbol id="squid" overflow="visible">
          <path d="M0,0 L20,-10 L40,0 L20,30 Z M25,0 Q30,40 10,60 M20,5 Q10,30 30,50 M15,0 Q0,40 20,50 M30,5 Q40,30 20,50 M35,0 Q50,40 30,60" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M0,0 L20,-10 L40,0 L20,30 Z" fill="currentColor"/>
        </symbol>
        <symbol id="deepfish" overflow="visible">
          <path d="M0,0 C10,-10 30,-5 40,0 C30,10 10,10 0,0Z M35,0 L45,5 L45,-5Z M10,-7 L15,-15 L20,-3Z M20,-3 C25,-15 35,-15 30,-2Z" fill="currentColor"/>
          <circle cx="5" cy="-2" r="1.5" fill="#7ce0d0"/>
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
        <g class="marine-moving-slow" opacity="0.65" fill="#71a9cf">
          <path d="M400,0 C410,-4 425,0 435,2 C425,4 410,6 400,0 Z M432,2 L440,0 L440,4 Z"/>
          <path d="M430,12 C440,8 455,12 465,14 C455,16 440,18 430,12 Z M462,14 L470,12 L470,16 Z"/>
          <path d="M370,-15 C380,-19 395,-15 405,-13 C395,-11 380,-9 370,-15 Z M402,-13 L410,-15 L410,-11 Z"/>
          <path d="M410,-28 C420,-32 435,-28 445,-26 C435,-24 420,-22 410,-28 Z M442,-26 L450,-28 L450,-24 Z"/>
          <path d="M450,-8 C460,-12 475,-8 485,-6 C475,-4 460,-2 450,-8 Z M482,-6 L490,-8 L490,-4 Z"/>
        </g>
      </g>
      <g id="marineShark" class="anim" opacity="0.8">
        <g class="marine-swimming">
          <path d="M600,0 C630,-15 720,0 750,-10 C760,0 750,15 720,5 C690,15 630,15 600,0 Z" fill="#144a6b"/>
          <path d="M660,-5 C670,-20 680,-25 680,-4 C675,-3 660,-5 660,-5 Z" fill="#144a6b"/>
          <path d="M670,3 C660,18 640,25 650,5 Z" fill="#09293e"/>
          <path d="M740,-8 C750,-20 760,-30 760,-5 C760,15 755,25 745,5 Z" fill="#144a6b"/>
        </g>
      </g>
      <g id="marineWhale" class="anim" opacity="0.8">
        <g class="marine-swimming-slow" fill="#0d3152">
          <!-- Distant Whale Silhouette -->
          <g transform="translate(600, -100) scale(0.6)" opacity="0.4">
            <path d="M1000,0 C1100,-80 1300,-20 1400,0 C1450,5 1450,20 1400,10 C1200,40 1100,60 1000,0 Z" fill="#0a223a"/>
            <path d="M1400,5 C1440,-10 1470,-30 1460,10 C1480,30 1460,50 1430,10 Z" fill="#0a223a"/>
          </g>
          <!-- Main Whale -->
          <g transform="translate(0, 40)">
            <path d="M1000,0 C1100,-80 1300,-20 1400,0 C1450,5 1450,20 1400,10 C1200,40 1100,60 1000,0 Z" fill="#0d3152"/>
            <path d="M1100,-35 C1150,-50 1250,-20 1300,5 C1200,30 1100,40 1100,-35 Z" fill="#1b476e" opacity="0.3"/>
            <path d="M1400,5 C1440,-10 1470,-30 1460,10 C1480,30 1460,50 1430,10 Z" fill="#0d3152"/>
            <path d="M1120,5 C1100,50 1030,100 1050,60 C1070,40 1100,10 1120,5 Z" fill="#071b2e"/>
          </g>
          <use href="#squid" x="1800" y="160" transform="scale(0.8)" opacity="0.7"/>
          <use href="#squid" x="1950" y="210" transform="scale(0.6)" opacity="0.5"/>
        </g>
        <g class="marine-swimming" fill="#0a223a" opacity="0.5">
          <use href="#school1" x="1400" y="120" transform="scale(0.8)"/>
          <use href="#school2" x="1700" y="240" transform="scale(1.2)" opacity="0.6"/>
        </g>
        <g class="marine-moving-slow" fill="#071b2e" opacity="0.3">
          <use href="#school2" x="300" y="90" transform="scale(0.5)"/>
          <use href="#school1" x="800" y="220" transform="scale(0.4)"/>
        </g>
      </g>
      <g id="marineOcto" class="anim" opacity="0.85">
        <g class="marine-bobbing" transform="translate(500,40)">
          <path d="M40,0 C10,-20 10,-80 40,-90 C70,-80 70,-20 40,0 Z" fill="#0c375e"/>
          <g fill="none" stroke="#0c375e" stroke-width="8" stroke-linecap="round" class="tentacles-sway">
            <path d="M25,-5 C10,30 0,60 15,90" />
            <path d="M35,-2 C20,35 25,75 35,100" />
            <path d="M45,-2 C60,40 55,80 45,110" />
            <path d="M55,-5 C70,30 80,60 65,90" />
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

        <path d="M-100,500 Q 200,420 700,520 T 1500,480 L 1500,900 L -100,900 Z" fill="#010f1c"/>
        <path d="M-100,560 Q 500,620 900,550 T 1500,580 L 1500,900 L -100,900 Z" fill="#00070f"/>
        
        <!-- Far back rocks + coral nodes -->
        <g fill="#021729">
          <path d="M 400,530 Q 420,480 480,540 Q 500,580 430,600 Z"/>
          <path d="M 980,510 Q 1020,440 1080,520 Q 1060,560 990,570 Z"/>
        </g>

        <path d="M 120,530 Q 150,420 220,530 Q 250,560 200,620 Z" fill="#03182b"/>
        <path d="M 80,590 Q 150,500 280,580 L 80,680 Z" fill="#010d18"/>
        <path d="M 1150,540 Q 1200,460 1280,520 Q 1330,560 1200,610 Z" fill="#021424"/>
        <path d="M 1250,570 Q 1350,480 1450,580 L 1200,680 Z" fill="#000810"/>
        
        <!-- Coral & Anemone shapes -->
        <g stroke="#093a52" stroke-width="4" fill="none" stroke-linecap="round" class="tentacles-sway">
          <path d="M420,570 Q410,540 400,520" />
          <path d="M430,580 Q435,530 440,500" />
          <path d="M440,570 Q460,540 470,510" />
          <path d="M1020,550 Q1010,510 990,480" />
          <path d="M1035,540 Q1040,490 1050,460" />
          <path d="M1050,550 Q1070,510 1090,470" />
        </g>

        <!-- Swaying Kelp -->
        <g class="kelp-sway" stroke="#0b3845" stroke-width="4" fill="none" stroke-linecap="round">
          <path d="M220,570 Q210,500 230,420 Q240,350 220,280"/>
          <path d="M240,580 Q260,500 230,420 Q210,360 250,290"/>
          <path d="M190,600 Q170,550 190,480 Q180,410 200,340"/>
          <path d="M1210,610 Q1180,540 1200,470 Q1190,400 1230,320"/>
        </g>
        <g class="kelp-sway-alt" stroke="#072b38" stroke-width="5" fill="none" stroke-linecap="round">
          <path d="M1250,560 Q1240,480 1270,410 Q1260,340 1280,270"/>
          <path d="M1290,570 Q1320,490 1290,410 Q1270,350 1310,260"/>
          <path d="M1220,600 Q1200,540 1230,470 Q1220,400 1250,330"/>
          <path d="M270,610 Q300,540 280,460 Q300,390 270,310"/>
        </g>

        <!-- Foreground Bed Wildlife -->
        <g class="marine-swimming-slow" fill="#09293e">
           <use href="#school1" x="1400" y="520" transform="scale(0.8)"/>
           <use href="#ray" x="1700" y="580" transform="scale(0.6)" opacity="0.7"/>
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
            <button data-depth="0">PLATFORM</button>
            <button data-depth="240">SOLUTION</button>
            <button data-depth="500">TECHNOLOGY</button>
            <button data-depth="680">DATA</button>
            <button data-depth="860">IMPACT</button>
          </nav>
          <div class="nav-depth"><span></span><b>000m</b></div>
        </header>

        <div class="story-copy">
          <article class="story-panel story-hero on" data-from="0" data-to="200">
            <span class="eyebrow">OCEAN DATA PLATFORM · SIH 2026</span>
            <h1 id="heroH1">
              <span id="titleOcean" style="display:inline-block; transform-origin: left top;">OCEAN</span><br/>
              <span id="titleEmbed" style="display:inline-block; transform-origin: left top;"><em>EMBED</em></span>
            </h1>
            <p>Connecting ocean observations and data to make what lies beneath easier to explore and understand.</p>
            <div class="scroll-cue"><i></i> SCROLL TO EXPLORE</div>
          </article>

          <article class="story-panel problem-panel" data-from="200" data-to="400">
            <span class="eyebrow">THE PROBLEM · 200—400m</span>
            <h2>THE OCEAN<br><em>IS VAST.</em></h2>
            <div class="problem-stack">
              <p>Observing it continuously is complex.</p>
              <p>Information can be spatially sparse and distributed across different sources.</p>
              <p class="accent">The challenge is not simply data.<br><strong>It is turning data into understanding.</strong></p>
            </div>
          </article>

          <article class="story-panel solution-panel" data-from="400" data-to="600">
            <span class="eyebrow">THE SOLUTION · 400—600m</span>
            <h2>FROM<br><em>DATA → INSIGHT</em></h2>
            <div class="pipeline" aria-label="OceanEmbed data workflow">
              <span data-node="observations">OBSERVATIONS</span>
              <i></i><span data-node="sources">DATA SOURCES</span>
              <i></i><span data-node="integration">INTEGRATION</span>
              <i></i><span data-node="analysis">PROCESSING / ANALYSIS</span>
              <i></i><span data-node="visualization">VISUALIZATION</span>
              <i></i><span data-node="insight">UNDERSTANDING / INSIGHT</span>
            </div>
          </article>

          <article class="story-panel data-panel" data-from="600" data-to="800">
            <span class="eyebrow">DATA LAYER · 600—800m</span>
            <h2>THE OCEAN<br><em>HAS SIGNALS.</em></h2>
            <div class="data-grid">
              <button class="info-card" data-focus="argo">
                <small>01 · OBSERVATION</small>
                <strong>ARGO</strong>
                <span>Autonomous floats provide observations through the ocean interior. In this journey, ARGO anchors the idea of observing conditions across depth.</span>
                <b>EXPLORE ↗</b>
              </button>
              <button class="info-card" data-focus="glorys">
                <small>02 · DATA / REANALYSIS</small>
                <strong>GLORYS</strong>
                <span>Relevant ocean data and reanalysis can provide broader context alongside observations, where used by the project.</span>
                <b>EXPLORE ↗</b>
              </button>
              <button class="info-card" data-focus="data">
                <small>03 · INTEGRATION</small>
                <strong>DATA</strong>
                <span>OceanEmbed brings relevant information into a workflow designed for clearer exploration and interpretation.</span>
                <b>EXPLORE ↗</b>
              </button>
            </div>
          </article>

          <article class="story-panel impact-panel" data-from="800" data-to="995">
            <span class="eyebrow">IMPACT · 800—1000m</span>
            <h2>MAKE THE<br><em>INVISIBLE VISIBLE.</em></h2>
            <div class="impact-flow">
              <span>COMPLEX OCEAN DATA</span><i>↓</i>
              <span>ORGANIZED INFORMATION</span><i>↓</i>
              <span>VISUAL UNDERSTANDING</span><i>↓</i>
              <span class="final-flow">ACTIONABLE INSIGHT</span>
            </div>
          </article>

          <article class="story-panel final-panel" data-from="995" data-to="1001">
            <span class="final-depth">1000m</span>
            <p>WE WENT DEEP.</p>
            <h2>NOW WE CAN SEE<br><em>WHAT LIES BENEATH.</em></h2>
            <strong>OCEAN EMBED</strong>
            <span>Mapping what lies beneath.</span>
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
  height: 1000vh;
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
  inset:0 0 auto 0;
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
  top:50%;
  width:min(560px,43vw);
  max-height:72vh;
  transform:translate3d(0,-44%,18px);
  opacity:0;
  transition:opacity .7s cubic-bezier(.2,.8,.2,1),transform .9s cubic-bezier(.2,.8,.2,1);
  z-index:2;
}
.story-panel.on {
  opacity:1;
  transform:translate3d(0,-50%,0);
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
  text-shadow:0 12px 50px rgba(0,0,0,.3);
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
  text-shadow:0 3px 22px rgba(0,0,0,.5);
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
  background:radial-gradient(ellipse at left center,rgba(3,24,43,.30),transparent 70%);
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

  useEffect(() => {
    function initOceanHero() {

      /* ══════════════════════════════════════════════════════════════
         TUNING — every number worth changing lives here.
         ══════════════════════════════════════════════════════════════ */
      const CFG = {
        maxDepth: 1000,   // metres at the end of the scroll
        pxPerMetre: 2.6,    // ruler spacing, in viewBox units
        restEnd: 0.0,   // p: intro holds until here (now animates immediately)
        moveEnd: 0.18,  // p: boat stops sliding right, float starts diving
        ease: 0.115,  // damping. lower = smoother + laggier
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
        glow: $('glow'), waterWrap: $('waterWrap'), rays: $('rays'), deepFade: $('deepFade'),
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

        /* ---- surface: waterline climbs as we dive -------------- */
        const waterY = mapE(p, R, M, Y(FY.waterRest), Y(FY.waterEnd));

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

        const depth = p <= M
          ? mapE(p, R, M, 0, 50)
          : map(p, M, 1, 50, CFG.maxDepth);

        /* ---- water body + waves ------------------------------- */
        N.waterWrap.style.transform = `translate(0px,${waterY}px)`;
        N.waves.style.transform = `translate(0px,${waterY}px)`;
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

        /* ---- ruler + guide line ------------------------------- */
        N.ruler.style.transform = `translate(${(X(narrow ? 0.34 : FX.ruler) - 300).toFixed(1)}px,${(fy - depth * CFG.pxPerMetre).toFixed(1)}px)`;
        N.ruler.style.opacity = String(ease((p - R * 0.6) / 0.18));
        N.guide.style.transform = `translate(0px,${fy}px)`;
        N.guide.style.opacity = String(ease((p - M) / 0.12) * 0.9);

        /* ---- depth cues --------------------------------------- */
        N.deepFade.setAttribute('opacity', (clamp(depth / 900) * 0.85).toFixed(3));
        N.skyDim.setAttribute('opacity', (clamp(depth / 1000) * 0.42).toFixed(3));
        N.argoHalo.setAttribute('opacity', clamp((depth - 120) / 420).toFixed(3));
        N.rays.setAttribute('opacity', (1 - clamp(depth / 260)).toFixed(3));
        N.snow.setAttribute('opacity', clamp((depth - 140) / 220).toFixed(3));
        N.pings.setAttribute('opacity', (0.35 + 0.65 * Math.abs(Math.sin(performance.now() / 900))).toFixed(3));

        /* ---- uplink beam -------------------------------------- */
        const mastX = bx + 51 * bs, mastY = by - 226 * bs;
        N.beam.setAttribute('d', `M ${sx.toFixed(1)} ${(sy + 36 * ss).toFixed(1)} L ${mastX.toFixed(1)} ${mastY.toFixed(1)}`);
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
        N.storyPanels.forEach((panel) => {
          const from = +panel.dataset.from, to = +panel.dataset.to;
          const active = depth >= from && depth < to;
          panel.classList.toggle('on', active);
        });
        N.navButtons.forEach((b) => {
          const d = +b.dataset.depth;
          b.classList.toggle('active', Math.abs(depth - d) < 110);
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
          const fishY = map(depth, 30, 250, 950, -150);
          N.marineFish.style.transform = `translate(0px,${fishY}px)`;
        }
        if (N.marineShark) {
          const sharkY = map(depth, 150, 500, 950, -150);
          N.marineShark.style.transform = `translate(0px,${sharkY}px)`;
        }
        if (N.marineWhale) {
          const whaleY = map(depth, 400, 750, 1050, -250);
          N.marineWhale.style.transform = `translate(0px,${whaleY}px)`;
        }
        if (N.marineOcto) {
          const octoY = map(depth, 650, 1000, 950, -100);
          N.marineOcto.style.transform = `translate(0px,${octoY}px)`;
        }
        if (N.marineBed) {
          const bedY = map(depth, 800, 1000, 600, 0);
          N.marineBed.style.transform = `translate(0px,${bedY}px)`;
        }

        /* ---- Cinematic Hero Title Sequence -------------------- */
        if (N.heroTitle) {
          // Title timing driven natively by exact physical depth metrics, guaranteeing the exact 35m trigger flawlessly
          // automatically avoiding desynchronization on wildly expanded track heights.
          const titleP = clamp((depth - 35) / 15);
          const revealP = clamp((depth - 42) / 8);

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
      N.navButtons.forEach((b) => b.addEventListener('click', () => jumpToDepth(+b.dataset.depth)));
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



