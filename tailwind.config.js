/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Gaming Custom Colors
        cyan: {
          DEFAULT: "#00d9ff",
          50: "#e6fbff",
          100: "#b3f4ff",
          200: "#80edff",
          300: "#4de6ff",
          400: "#1adfff",
          500: "#00d9ff",
          600: "#00aec9",
          700: "#008394",
          800: "#00585f",
          900: "#002d2a",
        },
        purple: {
          DEFAULT: "#9d4edd",
          50: "#f5e6ff",
          100: "#e6b3ff",
          200: "#d680ff",
          300: "#c64dff",
          400: "#b61aff",
          500: "#9d4edd",
          600: "#7a3daa",
          700: "#572c77",
          800: "#341b44",
          900: "#110a11",
        },
        pink: {
          DEFAULT: "#ff006e",
          50: "#ffe6f0",
          100: "#ffb3d1",
          200: "#ff80b2",
          300: "#ff4d93",
          400: "#ff1a74",
          500: "#ff006e",
          600: "#cc0058",
          700: "#990042",
          800: "#66002c",
          900: "#330016",
        },
        gaming: {
          dark: "#0a0a0f",
          card: "#1a1a24",
          muted: "#12121a",
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        glow: "0 0 20px rgba(0, 217, 255, 0.5)",
        "glow-purple": "0 0 20px rgba(157, 78, 221, 0.5)",
        "glow-pink": "0 0 20px rgba(255, 0, 110, 0.5)",
        "glow-lg": "0 0 40px rgba(0, 217, 255, 0.6)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 217, 255, 0.5)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 217, 255, 0.8)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        glitch: {
          "0%, 100%": { transform: "translate(0)" },
          "20%": { transform: "translate(-2px, 2px)" },
          "40%": { transform: "translate(-2px, -2px)" },
          "60%": { transform: "translate(2px, 2px)" },
          "80%": { transform: "translate(2px, -2px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "slide-up": "slide-up 0.5s ease-out",
        "slide-down": "slide-down 0.5s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        glitch: "glitch 3s infinite",
      },
      backgroundImage: {
        "gradient-gaming": "linear-gradient(135deg, #00d9ff 0%, #9d4edd 50%, #ff006e 100%)",
        "gradient-cyan": "linear-gradient(135deg, #00d9ff 0%, #9d4edd 100%)",
        "gradient-purple": "linear-gradient(135deg, #9d4edd 0%, #ff006e 100%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
