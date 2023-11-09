import './globals.css'
export const metadata = {
  title: 'JAMVIS',
  description: 'A visualiser for JAMScript applications',
}

export default function RootLayout({ children }) {
 return (
    <html lang="en" data-theme="darkmode">
      <body className="m-0">
        {children}
      </body>
    </html>
  )
}
