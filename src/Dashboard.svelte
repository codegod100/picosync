<script lang="ts">
import { onDestroy, onMount } from 'svelte'
import { insertData, queryData, runMigrations } from './lib/sqlite.ts'
import { persistDatabaseToDisk, syncDatabaseFromDisk } from './lib/sync.ts'
import { ulid } from 'ulid'

type UserRecord = {
  id: string
  name: string
  email: string
  role: string
}

let users = $state<UserRecord[]>([])
let isLoading = $state(true)
let savedRows = $state(new Set<string>())

const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Heidi']
const lastNames = ['Morg', 'Smith', 'Brown', 'Prince', 'Adams', 'Johnson', 'Taylor', 'Miller']
const roles = ['Developer', 'Designer', 'Analyst', 'Tester', 'Manager']

const pickRandom = (values: string[]) => values[Math.floor(Math.random() * values.length)]

const generateUser = (): UserRecord => {
  const first = pickRandom(firstNames)
  const last = pickRandom(lastNames)
  const id = ulid()
  return {
    id,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    role: pickRandom(roles),
  }
}

const highlightRow = (rowId: string) => {
  const next = new Set(savedRows)
  next.add(rowId)
  savedRows = next

  setTimeout(() => {
    const removal = new Set(savedRows)
    removal.delete(rowId)
    savedRows = removal
  }, 2000)
}

const loadUsers = async () => {
  try {
    isLoading = true
    const rows = await queryData('SELECT * FROM users ORDER BY id')
    users = rows.map(row => {
      const [id, name, email, role] = row as [string, string, string, string]
      return { id, name, email, role }
    })
  } catch (err) {
    console.error('Error loading users:', err)
  } finally {
    isLoading = false
  }
}

const createGeneratedUser = async () => {
  try {
    const user = generateUser()
    await insertData(
      'users',
      'id, name, email, role',
      `'${user.id}', '${user.name}', '${user.email}', '${user.role}'`,
    )
    await loadUsers()
    await persistDatabaseToDisk()
    highlightRow(user.id)
  } catch (err) {
    console.error('Error creating user:', err)
  }
}

let saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const debouncedSave = (originalUserId: string, rowElement: HTMLTableRowElement) => {
  if (saveTimeouts.has(originalUserId)) {
    clearTimeout(saveTimeouts.get(originalUserId))
  }

  const timeout = setTimeout(() => {
    saveUser(originalUserId, rowElement)
    saveTimeouts.delete(originalUserId)
  }, 1000)

  saveTimeouts.set(originalUserId, timeout)
}

const saveUser = async (userId: string, rowElement: HTMLTableRowElement) => {
  const cells = rowElement.querySelectorAll<HTMLElement>('[contenteditable]')
  if (cells.length < 4) return

  const id = (cells[0].textContent ?? '').trim()
  const name = (cells[1].textContent ?? '').trim()
  const email = (cells[2].textContent ?? '').trim()
  const role = (cells[3].textContent ?? '').trim()

  if (!id || !name || !email || !role) return

  try {
    if (id !== userId) {
      await insertData(
        'users',
        'id, name, email, role',
        `'${id}', '${name}', '${email}', '${role}'`,
      )
      await queryData(`DELETE FROM users WHERE id='${userId}'`)
      await loadUsers()
    } else {
      const sql = `UPDATE users SET name='${name}', email='${email}', role='${role}' WHERE id='${id}'`
      await queryData(sql)

      const userIndex = users.findIndex(user => user.id === userId)
      if (userIndex !== -1) {
        users[userIndex] = { id, name, email, role }
        users = [...users]
      }
    }

    highlightRow(id !== userId ? id : userId)
    await persistDatabaseToDisk()
  } catch (err) {
    console.error('Error updating user:', err)
  }
}

const deleteUser = async (userId: string) => {
  if (!confirm('Are you sure you want to delete this user?')) return

  try {
    await queryData(`DELETE FROM users WHERE id='${userId}'`)
    await loadUsers()
    const removal = new Set(savedRows)
    removal.delete(userId)
    savedRows = removal
    await persistDatabaseToDisk()
  } catch (err) {
    console.error('Error deleting user:', err)
  }
}

onMount(async () => {
  try {
    await syncDatabaseFromDisk()
    await runMigrations()
    await loadUsers()
  } catch (err) {
    console.error('Error initializing dashboard:', err)
  }
})

onDestroy(() => {
  for (const timeout of saveTimeouts.values()) {
    clearTimeout(timeout)
  }
  saveTimeouts.clear()
})
</script>

<main class="container">
  <article class="card">
    <header>
      <h1>SQLite Dashboard</h1>
      <p>Manage users with full CRUD operations</p>
      <div class="header-actions">
        <button class="btn btn-primary" onclick={createGeneratedUser}>
          Add New User
        </button>
      </div>
    </header>

    <section class="users-table">
      <h3>Users ({users.length})</h3>

      {#if isLoading}
        <div class="loading-container">
          <div class="spinner"></div>
          <span>Loading users from database...</span>
        </div>
      {:else if users.length === 0}
        <p>No users found. Create one to get started.</p>
      {:else}
        <div class="table-wrapper">
          <table class="table editable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each users as user}
                <tr
                  data-user-id={user.id}
                  class:saved={savedRows.has(user.id)}
                  oninput={(event) =>
                    debouncedSave(
                      user.id,
                      event.currentTarget as HTMLTableRowElement,
                    )}
                >
                  <td contenteditable>{user.id}</td>
                  <td contenteditable>{user.name}</td>
                  <td contenteditable>{user.email}</td>
                  <td contenteditable>{user.role}</td>
                  <td>
                    <button class="btn btn-danger" onclick={() => deleteUser(user.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  </article>
</main>

<style>
  .header-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1rem;
  }

  .users-table {
    margin-top: 2rem;
  }

  .table-wrapper {
    overflow-x: auto;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .table.editable td[contenteditable] {
    cursor: text;
    background: rgba(255, 255, 255, 0.02);
  }

  tr.saved {
    animation: savedFlash 0.6s ease;
  }

  @keyframes savedFlash {
    0% {
      background-color: rgba(64, 160, 43, 0.1);
    }
    100% {
      background-color: transparent;
    }
  }

  .loading-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--pico-muted-color);
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
