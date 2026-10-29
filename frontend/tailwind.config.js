/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e8ff',
          200: '#c3d0ff',
          300: '#96abfe',
          400: '#6479fc',
          500: '#4353f9',
          600: '#2f35ee',
          700: '#2528d3',
          800: '#2125aa',
          900: '#212686',
          950: '#14174f',
        },
        surface: {
          DEFAULT: '#0f1117',
          card: '#161b27',
          border: '#1e2536',
          hover: '#1a2233',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #4353f9 0%, #7c3aed 100%)',
        'gradient-dark': 'linear-gradient(135deg, #0f1117 0%, #161b27 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
