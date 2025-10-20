<script>
  import { onMount } from 'svelte';
  import { createTable, insertData, queryData } from './lib/sqlite.ts';
  import Dashboard from './Dashboard.svelte';

  let currentView = $state('home'); // 'home' or 'dashboard'
  let fixtureData = $state([]);
  let searchQuery = $state('');
  let filteredData = $derived(fixtureData.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.email.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  const loadData = async (query = '') => {
    try {
      let sql = 'SELECT * FROM users';
      if (query) {
        sql += ` WHERE name LIKE '%${query}%' OR email LIKE '%${query}%' OR role LIKE '%${query}%'`;
      }
      console.log("Querying database with SQL:", sql);
      const rows = await queryData(sql);
      fixtureData = rows.map(row => ({
        id: row[0],
        name: row[1],
        email: row[2],
        role: row[3],
      }));
    } catch (error) {
      console.error('Error querying SQLite:', error);
    }
  };

  onMount(async () => {
    try {
      // Create table
      await createTable('users', 'id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT');

      // Check if data exists
      const countRows = await queryData('SELECT COUNT(*) FROM users');
      const count = countRows[0][0];

      if (count === 0) {
        // Insert fixture data
        const data = [
          { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Developer' },
          { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'Designer' },
          { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'Designer' },
          { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'Analyst' },
          { id: 5, name: 'Eve Adams', email: 'eve@example.com', role: 'Tester' },
        ];

        for (const item of data) {
          await insertData('users', 'id, name, email, role', `${item.id}, '${item.name}', '${item.email}', '${item.role}'`);
        }
      }

      // Load initial data
      await loadData();
    } catch (error) {
      console.error('Error with SQLite:', error);
    }
  });

  $effect(() => {
    loadData(searchQuery);
  });

  // Reload data when switching back to home view
  $effect(() => {
    if (currentView === 'home') {
      loadData(searchQuery);
    }
  });
</script>

<main class="container">
  <nav class="nav">
    <button
      class="btn {currentView === 'home' ? 'btn-primary' : 'btn-secondary'}"
      onclick={() => currentView = 'home'}
    >
      Home
    </button>
    <button
      class="btn {currentView === 'dashboard' ? 'btn-primary' : 'btn-secondary'}"
      onclick={() => currentView = 'dashboard'}
    >
      Dashboard
    </button>
  </nav>

  {#if currentView === 'dashboard'}
    <Dashboard />
  {:else}
    <article class="card">
      <h1>Rsbuild with Svelte</h1>
      <p>Start building amazing things with Rsbuild.</p>

      <h2>Fixture Data</h2>
      <input type="search" placeholder="Search by name or email" bind:value={searchQuery} class="input" />

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
          {#each fixtureData as item}
            <tr>
              <td>{item.id}</td>
              <td>{item.name}</td>
              <td>{item.email}</td>
              <td>{item.role}</td>
            </tr>
          {/each}
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
    gap: 0.5rem 1rem; /* horizontal gap, vertical gap */
    align-items: flex-start;
  }

  .nav .btn {
    min-width: 100px;
  }
</style>
