import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BannerEditor from './BannerEditor'
import { BANNER_VAZIO, type Banner } from './bannerUpload'

/**
 * O editor do banner não é verificável no navegador sem sessão do painel, e é
 * ele que decide o que sobe para um bucket PÚBLICO. Estes testes cobrem a
 * parte que dói: arquivo grande demais e formato perigoso não podem sequer
 * chegar ao storage.
 *
 * Só `enviarBanner` é dublado — as validações rodam de verdade.
 */
const enviarBanner = vi.hoisted(() => vi.fn())
/**
 * A otimização usa canvas, que o jsdom não tem: o dublê devolve o que a de
 * verdade devolveria — um WebP menor e o relatório do que mudou.
 */
const otimizarImagem = vi.hoisted(() => vi.fn())

vi.mock('./bannerUpload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bannerUpload')>()),
  enviarBanner,
}))
vi.mock('./otimizarImagem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./otimizarImagem')>()),
  otimizarImagem,
}))

/** Casca com estado: o editor devolve uma função de atualização. */
function Editor({ inicial = BANNER_VAZIO }: { inicial?: Banner }) {
  const [banner, setBanner] = useState<Banner>(inicial)
  return (
    <BannerEditor
      banner={banner}
      onChange={(atualizar) => setBanner((atual) => atualizar(atual))}
    />
  )
}

function arquivo(nome: string, tipo: string, bytes: number): File {
  const file = new File(['x'], nome, { type: tipo })
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

const campoDesktop = () => screen.getByLabelText(/Enviar imagem desktop/i)

describe('BannerEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('começa vazio e sem campo de texto alternativo — não há o que descrever', () => {
    render(<Editor />)

    expect(screen.getByText(/Enviar imagem desktop/i)).toBeInTheDocument()
    expect(screen.getByText(/Enviar imagem celular/i)).toBeInTheDocument()
    expect(screen.queryByText('Texto alternativo')).not.toBeInTheDocument()
  })

  it('imagem pesada não é recusada: é reduzida, convertida e só então sobe', async () => {
    const pronto = arquivo('gigante.webp', 'image/webp', 180 * 1024)
    otimizarImagem.mockResolvedValue({
      arquivo: pronto,
      relatorio: {
        deBytes: 8 * 1024 * 1024,
        paraBytes: 180 * 1024,
        deLargura: 3200,
        paraLargura: 1600,
        deTipo: 'image/png',
        paraTipo: 'image/webp',
      },
    })
    enviarBanner.mockResolvedValue({ url: 'https://cdn/desktop.webp', largura: 1600, altura: 400 })
    render(<Editor />)

    await userEvent.upload(
      campoDesktop(),
      arquivo('gigante.png', 'image/png', 8 * 1024 * 1024)
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Otimizada: 8,0 MB → 180 KB · 3200 → 1600 px · WebP'
    )
    expect(otimizarImagem).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'gigante.png' }),
      { larguraMaxima: 1600, maxBytes: 1024 * 1024 }
    )
    // O que sobe é o arquivo otimizado, não o original.
    expect(enviarBanner).toHaveBeenCalledWith('desktop', pronto, '')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('quando nem a largura mínima cabe no limite, avisa em vez de subir', async () => {
    otimizarImagem.mockRejectedValue(new Error('Não deu para deixar a imagem abaixo de 1,0 MB sem estragá-la.'))
    render(<Editor />)

    await userEvent.upload(campoDesktop(), arquivo('ruido.png', 'image/png', 9 * 1024 * 1024))

    expect(await screen.findByRole('alert')).toHaveTextContent(/abaixo de 1,0 MB/)
    expect(enviarBanner).not.toHaveBeenCalled()
  })

  it('barra SVG mesmo quando ele escapa do filtro do seletor de arquivos', async () => {
    render(<Editor />)

    // `applyAccept: false` imita o que o `accept` do input NÃO garante — um
    // arquivo escolhido por caminho alternativo. A validação da tela é a
    // segunda barreira, e é ela que está sendo testada aqui.
    await userEvent.upload(
      campoDesktop(),
      arquivo('logo.svg', 'image/svg+xml', 1000),
      { applyAccept: false }
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Formato não aceito/
    )
    expect(enviarBanner).not.toHaveBeenCalled()
  })

  it('mostra a prévia e abre o campo de alt depois de um envio válido', async () => {
    const leve = arquivo('banner.webp', 'image/webp', 120_000)
    // Já servia: a otimização devolve o próprio arquivo e nenhum aviso aparece.
    otimizarImagem.mockResolvedValue({
      arquivo: leve,
      relatorio: { deBytes: 120_000, paraBytes: 120_000, deLargura: 1600, paraLargura: 1600, deTipo: 'image/webp', paraTipo: 'image/webp' },
    })
    enviarBanner.mockResolvedValue({
      url: 'https://cdn/desktop.webp',
      largura: 1600,
      altura: 400,
    })
    render(<Editor />)

    await userEvent.upload(campoDesktop(), leve)

    await waitFor(() =>
      expect(screen.getByAltText(/Prévia do banner desktop/i)).toHaveAttribute(
        'src',
        'https://cdn/desktop.webp'
      )
    )
    expect(screen.getByText('1600 × 400')).toBeInTheDocument()
    expect(screen.getByText('Texto alternativo')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('remove a arte sem apagar a que está no ar até o formulário ser salvo', async () => {
    render(
      <Editor
        inicial={{
          desktop: { url: 'https://cdn/a.webp', largura: 1600, altura: 400 },
          mobile: null,
          alt: 'Oferta',
        }}
      />
    )

    await userEvent.click(
      screen.getByRole('button', { name: /Remover desktop/i })
    )

    await waitFor(() =>
      expect(screen.queryByAltText(/Prévia do banner desktop/i)).toBeNull()
    )
    // A remoção é só do formulário: nenhuma chamada de storage acontece aqui.
    expect(enviarBanner).not.toHaveBeenCalled()
  })
})
