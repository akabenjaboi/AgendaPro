/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta principal: Custom Cyan
        brand: {
          50:  '#E3FDFD', // Fondo principal o sutil
          100: '#CBF1F5', // Fondos secundarios / hover sutil
          200: '#B8E9ED',
          300: '#A6E3E9', // Bordes activos / acentos suaves
          400: '#8CD6DC',
          500: '#71C9CE', // Primary button bg
          600: '#52B0B6', // Primary button hover
          700: '#3A8A8F', // Contrast text
          800: '#266468',
          900: '#164346',
          950: '#0A2527',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
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
}
