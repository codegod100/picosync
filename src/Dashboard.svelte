<script>
  import { onMount } from 'svelte';
  import { createTable, insertData, queryData } from './lib/sqlite.ts';

  let users = $state([]);
  let isLoading = $state(true);
  let showCreateForm = $state(false);
  let editingUser = $state(null);

  // Form data
  let newUser = $state({ name: '', email: '', role: '' });
  let editUser = $state({ id: null, name: '', email: '', role: '' });

  const loadUsers = async () => {
    try {
      isLoading = true;
      const rows = await queryData('SELECT * FROM users ORDER BY id');
      users = rows.map(row => ({
        id: row[0],
        name: row[1],
        email: row[2],
        role: row[3],
      }));
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      isLoading = false;
    }
  };

  const createUser = async (event) => {
    event.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.role) return;

    try {
      await insertData('users', 'name, email, role', `'${newUser.name}', '${newUser.email}', '${newUser.role}'`);
      newUser = { name: '', email: '', role: '' };
      showCreateForm = false;
      await loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const startEdit = (user) => {
    editingUser = user.id;
    editUser = { ...user };
  };

  const cancelEdit = () => {
    editingUser = null;
    editUser = { id: null, name: '', email: '', role: '' };
  };

  const updateUser = async () => {
    if (!editUser.id || !editUser.name || !editUser.email || !editUser.role) return;

    try {
      // If ID changed, we need to handle it differently since it's the primary key
      if (editUser.id !== editingUser) {
        // Insert new record with new ID
        await insertData('users', 'id, name, email, role', `${editUser.id}, '${editUser.name}', '${editUser.email}', '${editUser.role}'`);
        // Delete old record
        await queryData(`DELETE FROM users WHERE id=${editingUser}`);
      } else {
        // Simple update
        const sql = `UPDATE users SET name='${editUser.name}', email='${editUser.email}', role='${editUser.role}' WHERE id=${editUser.id}`;
        await queryData(sql);
      }

      editingUser = null;
      editUser = { id: null, name: '', email: '', role: '' };
      await loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await queryData(`DELETE FROM users WHERE id=${userId}`);
      await loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  onMount(async () => {
    try {
      // Ensure table exists
      await createTable('users', 'id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT');
      await loadUsers();
    } catch (error) {
      console.error('Error initializing dashboard:', error);
    }
  });
</script>

<main class="container">
  <article class="card">
    <header>
      <h1>SQLite Dashboard</h1>
      <p>Manage users with full CRUD operations</p>
      <div class="header-actions">
        <button class="btn btn-primary" onclick={() => showCreateForm = !showCreateForm}>
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
            <input
              id="name"
              type="text"
              bind:value={newUser.name}
              placeholder="Enter name"
              required
            />
          </div>
          <div class="form-group">
            <label for="email">Email:</label>
            <input
              id="email"
              type="email"
              bind:value={newUser.email}
              placeholder="Enter email"
              required
            />
          </div>
          <div class="form-group">
            <label for="role">Role:</label>
            <input
              id="role"
              type="text"
              bind:value={newUser.role}
              placeholder="Enter role"
              required
            />
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
        <p>Loading users...</p>
      {:else if users.length === 0}
        <p>No users found. <button class="btn btn-link" onclick={() => showCreateForm = true}>Create your first user</button></p>
      {:else}
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each users as user (user.id)}
              <tr>
                {#if editingUser === user.id}
                  <td>
                    <input
                      type="number"
                      bind:value={editUser.id}
                      placeholder="ID"
                      required
                      class="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      bind:value={editUser.name}
                      placeholder="Name"
                      required
                      class="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="email"
                      bind:value={editUser.email}
                      placeholder="Email"
                      required
                      class="table-input"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      bind:value={editUser.role}
                      placeholder="Role"
                      required
                      class="table-input"
                    />
                  </td>
                  <td class="action-buttons">
                    <button class="btn btn-success btn-sm" onclick={updateUser}>Save</button>
                    <button class="btn btn-secondary btn-sm" onclick={cancelEdit}>Cancel</button>
                  </td>
                {:else}
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick={() => startEdit(user)}>Edit</button>
                    <button class="btn btn-danger btn-sm" onclick={() => deleteUser(user.id)}>Delete</button>
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
  </article>
</main>

<style>
  .create-form {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 0.5rem;
    background: #f9f9f9;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }

  .form-group input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 0.25rem;
  }

  .btn-sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    margin-right: 0.25rem;
    min-width: 60px;
  }

  .btn {
    min-width: 100px;
  }

  .btn-link {
    background: none;
    border: none;
    color: #007bff;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
  }

  .btn-link:hover {
    color: #0056b3;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action-buttons .btn-sm {
    margin-right: 0; /* Remove individual margin since we're using gap */
  }

  .form-actions {
    margin-top: 1rem;
    display: flex;
    justify-content: flex-end;
  }

  .header-actions {
    margin-top: 1rem;
  }

  .table-input {
    width: 100%;
    padding: 0.25rem;
    border: 1px solid #ccc;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .action-buttons {
    min-width: 140px; /* Ensure consistent column width */
  }
</style>