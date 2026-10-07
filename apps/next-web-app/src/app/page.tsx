import type { Metadata } from 'next'
import type { JSX } from 'react'
import { HomeScreen } from 'compositions/screens/home/server'

/**
 * Метаданные главной страницы.
 */
export const metadata: Metadata = {
  title: 'Главная'
}

/**
 * Подключает главный экран к корневому маршруту Next.js.
 *
 * Используется для:
 *  - отделения служебных параметров страницы от DOM-атрибутов экрана
 */
const HomePage = (): JSX.Element => {
  return <HomeScreen />
}

export default HomePage
