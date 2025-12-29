/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#fef7e6',
                    100: '#fdecc7',
                    200: '#fbd78c',
                    300: '#f9c051',
                    400: '#f7a81f',
                    500: '#e08b0a',
                    600: '#c46a06',
                    700: '#9e4b09',
                    800: '#823c10',
                    900: '#6e3211',
                },
                dark: {
                    50: '#f6f6f9',
                    100: '#ececf2',
                    200: '#d5d6e2',
                    300: '#b1b3c8',
                    400: '#8789a9',
                    500: '#686a8f',
                    600: '#535576',
                    700: '#444560',
                    800: '#3b3b51',
                    900: '#1a1a2e',
                    950: '#0f0f1a',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
