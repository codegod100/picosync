<script>
import { onDestroy, onMount } from 'svelte'
import { insertData, queryData, runMigrations } from './lib/sqlite.ts'
import { persistDatabaseToDisk, syncDatabaseFromDisk } from './lib/sync.ts'
import { ulid } from 'ulid'

let users = $state([])
let isLoading = $state(true)
let showCreateForm = $state(false)
let savedRows = $state(new Set())

let newUser = $state({ name: '', email: '', role: '' })

const loadUsers = async () => {
  try {
    isLoading = true
    const rows = await queryData('SELECT * FROM users ORDER BY id')
    users = rows.map(row => ({
      id: row[0],
      name: row[1],
      email: row[2],
      role: row[3],
    }))
  } catch (err) {
    console.error('Error loading users:', err)
  } finally {
    isLoading = false
  }
}

const createUser = async event => {
  event.preventDefault()
  if (!newUser.name || !newUser.email || !newUser.role) return

  try {
    const userId = ulid()
    await insertData(
      'users',
      'id, name, email, role',
      `'${userId}', '${newUser.name}', '${newUser.email}', '${newUser.role}'`,
    )
    newUser = { name: '', email: '', role: '' }
    showCreateForm = false
    await loadUsers()
    await persistDatabaseToDisk()
  } catch (err) {
    console.error('Error creating user:', err)
  }
}

let saveTimeouts = new Map()

const debouncedSave = (originalUserId, rowElement) => {
  if (saveTimeouts.has(originalUserId)) {
    clearTimeout(saveTimeouts.get(originalUserId))
  }

  const timeout = setTimeout(() => {
    saveUser(originalUserId, rowElement)
    saveTimeouts.delete(originalUserId)
  }, 1000)

  saveTimeouts.set(originalUserId, timeout)
}

const saveUser = async (userId, rowElement) => {
  const cells = rowElement.querySelectorAll('[contenteditable]')
  const id = cells[0].textContent.trim()
  const name = cells[1].textContent.trim()
  const email = cells[2].textContent.trim()
  const role = cells[3].textContent.trim()

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

    await persistDatabaseToDisk()

    const savedId = id !== userId ? id : userId
    savedRows.add(savedId)

    setTimeout(() => {
      savedRows.delete(savedId)
    }, 2000)
  } catch (err) {
    console.error('Error updating user:', err)
  }
}

const deleteUser = async userId => {
  if (!confirm('Are you sure you want to delete this user?')) return

  try {
    await queryData(`DELETE FROM users WHERE id='${userId}'`)
    await loadUsers()
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
        <button class="btn btn-primary" onclick={() => (showCreateForm = !showCreateForm)}>
          {showCreateForm ? 'Cancel' : 'Add New User'}
        </button>
      </div>
    </header>

    {#if showCreateForm}
      <section class="create-form">
        <h3>Create New User</h3>
        <form onsubmit={createUser}>
          <div class="form-group">
            <label for="name">Name:</label>
            <input id="name" type="text" bind:value={newUser.name} placeholder="Enter name" required />
          </div>
          <div class="form-group">
            <label for="email">Email:</label>
            <input id="email" type="email" bind:value={newUser.email} placeholder="Enter email" required />
          </div>
          <div class="form-group">
            <label for="role">Role:</label>
            <input id="role" type="text" bind:value={newUser.role} placeholder="Enter role" required />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-success">Create User</button>
          </div>
        </form>
      </section>
    {/if}

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
                  oninput={(event) => debouncedSave(user.id, event.currentTarget)}
                >
                  <td contenteditable>{user.id}</td>
                  <td contenteditable>{user.name}</td>
                  <td contenteditable>{user.email}</td>
                  <td contenteditable>{user.role}</td>
                  <td>
                    <button class="btn btn-danger" onclick={() => deleteUser(user.id)}>Delete</button>
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

  .create-form {
    margin-top: 1.5rem;
    padding: 1.5rem;
    border: 1px solid var(--pico-form-element-border-color);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
  }

  .create-form .form-group {
    margin-bottom: 1rem;
  }

  .create-form label {
    display: block;
    margin-bottom: 0.35rem;
    color: var(--pico-muted-color);
    font-weight: 600;
  }

  .create-form input {
    width: 100%;
    padding: 0.75rem;
    border-radius: 8px;
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
