import { writable } from "svelte/store"

export const createSearchStore = (data: Contact[]) => {
    const { subscribe, set, update } = writable({
        data,
        filtered: data,
        search: '',
    })

    return {
        subscribe,
        set,
        update,
    }
}

export const searchHandler = (store: any) => {
    const searchTerm = store.search.toLowerCase() || ""
    store.filtered = store.data.filter((item: any) => {
        return item.searchTerms.toLowerCase().includes(searchTerm)
    })
}