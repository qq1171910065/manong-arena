import { nextTick, onMounted, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { Component } from 'vue'

export interface ScrollSpyTab {
  id: string
  label: string
  badge?: string | number
}

export interface ScrollSpyGroup {
  id: string
  label: string
  icon?: Component
  items: ScrollSpyTab[]
}

export function flattenScrollSpyGroups(groups: ScrollSpyGroup[]): ScrollSpyTab[] {
  return groups.flatMap((group) => group.items)
}



function sectionSelector(id: string): string {

  return `[id="section-${id}"]`

}



function smoothScrollTo(root: HTMLElement, targetTop: number, duration = 520) {

  const start = root.scrollTop

  const delta = targetTop - start

  if (Math.abs(delta) < 1) return



  const t0 = performance.now()

  function frame(now: number) {

    const progress = Math.min(1, (now - t0) / duration)

    const eased = 1 - Math.pow(1 - progress, 3)

    root.scrollTop = start + delta * eased

    if (progress < 1) requestAnimationFrame(frame)

  }

  requestAnimationFrame(frame)

}



/** 锚点滚动 + 目录高亮；滚动容器为 scrollRoot（内容列） */

export function useScrollSpySections(

  tabs: Ref<ScrollSpyTab[]> | ComputedRef<ScrollSpyTab[]>,

  scrollRoot: Ref<HTMLElement | null>

) {

  const activeSection = ref('')

  let observer: IntersectionObserver | null = null

  let scrollUnlockTimer: ReturnType<typeof setTimeout> | null = null

  let scrollingProgrammatically = false



  function scrollToSection(id: string) {

    const root = scrollRoot.value

    if (!root) return

    const el = root.querySelector<HTMLElement>(sectionSelector(id))

    if (!el) return



    scrollingProgrammatically = true

    activeSection.value = id



    const rootRect = root.getBoundingClientRect()

    const elRect = el.getBoundingClientRect()

    const targetTop = root.scrollTop + (elRect.top - rootRect.top) - 8

    smoothScrollTo(root, Math.max(0, targetTop))



    if (scrollUnlockTimer) clearTimeout(scrollUnlockTimer)

    scrollUnlockTimer = setTimeout(() => {

      scrollingProgrammatically = false

    }, 600)

  }



  function bindObserver() {

    observer?.disconnect()

    const root = scrollRoot.value

    const ids = tabs.value.map((t) => t.id)

    if (!root || !ids.length) return



    if (!activeSection.value || !ids.includes(activeSection.value)) {

      activeSection.value = ids[0]

    }



    observer = new IntersectionObserver(

      (entries) => {

        if (scrollingProgrammatically) return

        const visible = entries

          .filter((entry) => entry.isIntersecting)

          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        const target = visible[0]?.target as HTMLElement | undefined

        if (!target?.id?.startsWith('section-')) return

        activeSection.value = target.id.slice('section-'.length)

      },

      { root, rootMargin: '-10% 0px -55% 0px', threshold: [0, 0.12, 0.35, 0.65] }

    )



    for (const id of ids) {

      const el = root.querySelector(sectionSelector(id))

      if (el) observer.observe(el)

    }

  }



  watch(tabs, () => nextTick(bindObserver), { deep: true })

  watch(scrollRoot, () => nextTick(bindObserver))



  onMounted(() => nextTick(bindObserver))

  onUnmounted(() => {

    observer?.disconnect()

    if (scrollUnlockTimer) clearTimeout(scrollUnlockTimer)

  })



  return { activeSection, scrollToSection, refreshSpy: bindObserver }

}


