<script>
import { onDestroy, onMount } from 'svelte'
import { insertData, queryData, runMigrations, exportDatabase } from './lib/sqlite.ts'
import { persistDatabaseToDisk, syncDatabaseFromDisk, getDaemonStub } from './lib/sync.ts'
import { ulid } from 'ulid'
import Dashboard from './Dashboard.svelte'
import Spinner from './lib/Spinner.svelte'

let currentView = $state('home')
let fixtureData = $state([])
let searchQuery = $state('')
let isLoading = $state(true)
let error = $state(null)
let databaseReady = $state(false)
let initialLoad = $state(true)

const fuzzyMatch = (text, query) => {
  if (!query) return true
  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()
  let queryIndex = 0

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) queryIndex++
  }

  return queryIndex === queryLower.length
}

let filteredData = $derived(
  fixtureData.filter(
    item =>
      fuzzyMatch(item.name, searchQuery) ||
      fuzzyMatch(item.email, searchQuery) ||
      fuzzyMatch(item.role, searchQuery),
  ),
)

const getRouteFromUrl = () => {
  const hash = window.location.hash.slice(1)
  return hash === 'dashboard' ? 'dashboard' : 'home'
}

const updateUrl = view => {
  window.history.pushState(null, '', view === 'home' ? '/' : '/#dashboard')
}

const handlePopState = () => {
  currentView = getRouteFromUrl()
}

const loadData = async (query = '') => {
  try {
    isLoading = true
    error = null
    let sql = 'SELECT * FROM users'
    if (query) {
      sql += ` WHERE name LIKE '%${query}%' OR email LIKE '%${query}%' OR role LIKE '%${query}%'`
    }
    console.log('Querying database with SQL:', sql)
    const rows = await queryData(sql)
    fixtureData = rows.map(row => ({
      id: row[0],
      name: row[1],
      email: row[2],
      role: row[3],
    }))
  } catch (err) {
    console.error('Error querying SQLite:', err)
    error = 'Failed to load data from database. Please try refreshing the page.'
  } finally {
    isLoading = false
  }
}

const checkSync = async () => {
  try {
    const localBytes = await exportDatabase()
    const stub = await getDaemonStub()
    const remoteBytes = await stub.fetchDatabase()
    if (!remoteBytes || remoteBytes.length === 0) {
      console.log('Remote is empty, syncing local to remote...')
      await persistDatabaseToDisk()
      console.log('Sync completed, re-checking...')
      const newRemoteBytes = await stub.fetchDatabase()
      const newRemoteSize = newRemoteBytes ? newRemoteBytes.length : 0
      console.log('After sync, remote size:', newRemoteSize, 'local size:', localBytes.length)
      if (newRemoteSize === localBytes.length) {
        console.log('Sync successful')
      } else {
        console.log('Sync failed')
      }
    } else {
      const localSize = localBytes.length
      const remoteSize = remoteBytes.length
      const synced = localSize === remoteSize && localBytes.every((b, i) => b === remoteBytes[i])
      if (synced) {
        console.log('Databases are synced, size:', localSize)
      } else {
        console.log('Databases are not synced, local size:', localSize, 'remote size:', remoteSize)
      }
    }
  } catch (err) {
    console.error('Error checking sync:', err)
  }
}

onMount(async () => {
  try {
    currentView = getRouteFromUrl()
    window.addEventListener('popstate', handlePopState)

    await syncDatabaseFromDisk()
    await runMigrations()

    const countRows = await queryData('SELECT COUNT(*) FROM users')
    const count = Number(countRows[0]?.[0] ?? 0)

    if (count === 0) {
      const data = [
        { id: ulid(), name: 'Alice Morg', email: 'alice@example.com', role: 'Developer' },
        { id: ulid(), name: 'Bob Smith', email: 'bob@example.com', role: 'Designer' },
        { id: ulid(), name: 'Charlie Brown', email: 'charlie@example.com', role: 'Designer' },
        { id: ulid(), name: 'Diana Prince', email: 'diana@example.com', role: 'Analyst' },
        { id: ulid(), name: 'Eve Adams', email: 'eve@example.com', role: 'Tester' },
      ]

      for (const item of data) {
        await insertData(
          'users',
          'id, name, email, role',
          `'${item.id}', '${item.name}', '${item.email}', '${item.role}'`,
        )
      }

      try {
        await persistDatabaseToDisk()
      } catch (err) {
        console.error('Error persisting database after insert:', err)
      }
    }

    await loadData()
    initialLoad = false
    databaseReady = true
    try {
      await persistDatabaseToDisk()
    } catch (err) {
      console.error('Error persisting database after load:', err)
    }
  } catch (err) {
    console.error('Error initializing app:', err)
    error =
      'Failed to initialize the application. Please check your browser compatibility and try again.'
    isLoading = false
  }
})

$effect(() => {
  if (databaseReady) loadData(searchQuery)
})

$effect(() => {
  if (databaseReady && currentView === 'home') loadData(searchQuery)
})

onDestroy(() => {
  window.removeEventListener('popstate', handlePopState)
})
</script>

<main class="container">
  <nav class="nav">
    <button
      class="btn {currentView === 'home' ? 'btn-primary' : 'btn-secondary'}"
      onclick={() => {
        currentView = 'home'
        updateUrl('home')
      }}
    >
      Home
    </button>
    <button
      class="btn {currentView === 'dashboard' ? 'btn-primary' : 'btn-secondary'}"
      onclick={() => {
        currentView = 'dashboard'
        updateUrl('dashboard')
      }}
    >
      Dashboard
    </button>
  </nav>

  {#if error}
    <div class="error-banner">
      <p>{error}</p>
      <button
        class="btn btn-secondary"
        onclick={() => {
          error = null
          loadData(searchQuery)
        }}
      >Retry</button>
    </div>
  {/if}

  {#if currentView === 'dashboard'}
    <Dashboard />
  {:else}
    <article class="card">
      <h1>Rsbuild with Svelte</h1>
      <p>Start building amazing things with Rsbuild.</p>

      <h2>Fixture Data</h2>
      <input
        type="search"
        placeholder="Search by name or email"
        bind:value={searchQuery}
        class="input"
      />

      <button class="btn btn-secondary" onclick={checkSync}>Check Sync</button>

      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {#if isLoading && initialLoad}
            <tr>
              <td colspan="4" style="text-align: center;"><Spinner /></td>
            </tr>
          {:else}
            {#each filteredData as item}
              <tr>
                <td>{item.id}</td>
                <td>{item.name}</td>
                <td>{item.email}</td>
                <td>{item.role}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </article>
  {/if}
</main>

<style>
  .nav {
    margin-bottom: 2rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: flex-start;
  }

  .nav .btn {
    min-width: 100px;
  }

  .error-banner {
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .error-banner p {
    margin: 0;
    flex-grow: 1;
  }

  .error-banner .btn {
    margin-left: 1rem;
    min-width: 80px;
  }
</style>
