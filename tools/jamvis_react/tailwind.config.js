/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  daisyui: {
    themes: [
      { 
        darkmode: {
          "primary": "#70A0AF",
          "secondary": "#6be0bf",
          "accent": "#2f2fef",
          "neutral": "#484848",
          "base-100": "#3A3A40",
          "info": "#5692eb",
          "success": "#136741",
          "warning": "#946005",
          "error": "#fb1d09",
        },
      },
    ],
  },
  plugins: [require('daisyui')],
}
