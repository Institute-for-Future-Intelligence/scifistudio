/*
 * Copyright 2026 Institute for Future Intelligence, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { Typography } from 'antd'
import { useTranslation, Trans } from 'react-i18next'

const { Title, Paragraph } = Typography

const ifiLink = <a href="https://intofuture.org" target="_blank" rel="noopener noreferrer" />

function About() {
  const { t } = useTranslation()

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>{t('about.title')}</Title>
      <Paragraph style={{ fontSize: 16 }}>
        <Trans i18nKey="about.description" components={{ 1: ifiLink }} />
      </Paragraph>
      <Title level={4}>{t('about.missionTitle')}</Title>
      <Paragraph>
        {t('about.missionDescription')}
      </Paragraph>
      <Title level={4}>{t('about.contactTitle')}</Title>
      <Paragraph>
        <Trans i18nKey="about.contactDescription" components={{ 1: ifiLink }} />
      </Paragraph>
      <Paragraph>
        <Trans i18nKey="about.contactPerson" components={{ 1: <a href="mailto:charles@intofuture.org" /> }} />
      </Paragraph>
    </div>
  )
}

export default About
