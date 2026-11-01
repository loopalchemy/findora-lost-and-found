const now = '2026-10-20T12:00:00.000Z';

function createMemoryPool(overrides = {}) {
  const state = {
    users: overrides.users || [],
    categories: overrides.categories || [
      { category_id: 1, category_name: 'Electronics', description: 'Phones and devices' },
      { category_id: 2, category_name: 'Books & stationery', description: 'Books and stationery' },
    ],
    items: overrides.items || [
      { item_id: 1, user_id: 2, category_id: 1, item_type: 'found', item_name: 'Blue notebook', description: 'A blue ruled notebook with a label.', location: 'Main Library', item_date: '2026-10-19', colour: 'blue', image_path: null, status: 'Approved', created_at: now },
      { item_id: 2, user_id: 1, category_id: 1, item_type: 'found', item_name: 'Student found item', description: 'An item submitted by the signed-in user.', location: 'Science Block', item_date: '2026-10-18', colour: null, image_path: null, status: 'Approved', created_at: now },
      { item_id: 3, user_id: 2, category_id: 1, item_type: 'lost', item_name: 'Blue notebook report', description: 'A notebook reported lost.', location: 'Main Library', item_date: '2026-10-18', colour: 'blue', image_path: null, status: 'Pending review', created_at: now },
    ],
    claims: overrides.claims || [],
    nextUserId: 10,
    nextCategoryId: 3,
    nextItemId: 4,
    nextClaimId: 1,
  };
  state.nextUserId = Math.max(state.nextUserId, ...state.users.map((row) => Number(row.user_id || 0) + 1));
  state.nextCategoryId = Math.max(state.nextCategoryId, ...state.categories.map((row) => Number(row.category_id || 0) + 1));
  state.nextItemId = Math.max(state.nextItemId, ...state.items.map((row) => Number(row.item_id || 0) + 1));
  state.nextClaimId = Math.max(state.nextClaimId, ...state.claims.map((row) => Number(row.claim_id || 0) + 1));

  const pool = {
    state,
    async execute(sql, params = []) {
      const q = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      const like = (value, pattern) => String(value || '').toLowerCase().includes(String(pattern || '').replaceAll('%', '').toLowerCase());

      if (q.startsWith('select user_id as id, full_name as name, email, role from users where user_id = ?')) {
        const user = state.users.find((row) => Number(row.user_id) === Number(params[0]));
        return [user ? [{ id: user.user_id, name: user.full_name, email: user.email, role: user.role }] : []];
      }
      if (q.startsWith('select user_id as id, full_name as name, email, password_hash as passwordhash')) {
        const user = state.users.find((row) => row.email.toLowerCase() === String(params[0]).toLowerCase());
        return [user ? [{ id: user.user_id, name: user.full_name, email: user.email, role: user.role, passwordHash: user.password_hash }] : []];
      }
      if (q.includes('from users where lower(email) = lower(?)')) {
        const user = state.users.find((row) => row.email.toLowerCase() === String(params[0]).toLowerCase());
        return [user ? [{ user_id: user.user_id }] : []];
      }
      if (q.startsWith('insert into users')) {
        const [fullName, email, passwordHash, role] = params;
        if (state.users.some((row) => row.email.toLowerCase() === String(email).toLowerCase())) {
          const error = new Error('Duplicate email'); error.code = 'ER_DUP_ENTRY'; throw error;
        }
        const user_id = state.nextUserId++;
        state.users.push({ user_id, full_name: fullName, email, password_hash: passwordHash, role, created_at: now });
        return [{ insertId: user_id, affectedRows: 1 }];
      }
      if (q.startsWith('select user_id as id, full_name as name, email, role, created_at as createdat from users')) {
        return [[...state.users].sort((a, b) => b.user_id - a.user_id).map((row) => ({ id: row.user_id, name: row.full_name, email: row.email, role: row.role, createdAt: row.created_at }))];
      }

      if (q.startsWith('select category_id as id, category_name as name, description from categories')) {
        return [[...state.categories].sort((a, b) => a.category_name.localeCompare(b.category_name)).map((row) => ({ id: row.category_id, name: row.category_name, description: row.description }))];
      }
      if (q.startsWith('select category_id from categories where category_name = ?')) {
        const category = state.categories.find((row) => row.category_name === params[0]);
        return [category ? [{ category_id: category.category_id }] : []];
      }
      if (q.startsWith('select category_id from categories where category_id = ?')) {
        const category = state.categories.find((row) => Number(row.category_id) === Number(params[0]));
        return [category ? [{ category_id: category.category_id }] : []];
      }
      if (q.startsWith('insert into categories')) {
        const [category_name, description] = params;
        if (state.categories.some((row) => row.category_name.toLowerCase() === String(category_name).toLowerCase())) {
          const error = new Error('Duplicate category'); error.code = 'ER_DUP_ENTRY'; throw error;
        }
        const category_id = state.nextCategoryId++;
        state.categories.push({ category_id, category_name, description, created_at: now });
        return [{ insertId: category_id, affectedRows: 1 }];
      }
      if (q.startsWith('select count(*) as total from items where category_id = ?')) {
        return [[{ total: state.items.filter((row) => Number(row.category_id) === Number(params[0])).length }]];
      }
      if (q.startsWith('delete from categories where category_id = ?')) {
        const before = state.categories.length;
        state.categories = state.categories.filter((row) => Number(row.category_id) !== Number(params[0]));
        return [{ affectedRows: before - state.categories.length }];
      }

      if (q.startsWith('select i.item_id as id')) {
        let rows = [...state.items];
        if (/where i\.item_id = \?/.test(q)) rows = rows.filter((row) => Number(row.item_id) === Number(params[0]));
        else if (/where i\.user_id = \?/.test(q)) rows = rows.filter((row) => Number(row.user_id) === Number(params[0]));
        else {
          let parameterIndex = 0;
          if (q.includes("i.status in ('approved', 'recovered')")) rows = rows.filter((row) => ['Approved', 'Recovered'].includes(row.status));
          if (q.includes('i.status = ?')) {
            const status = params[parameterIndex++];
            rows = rows.filter((row) => row.status === status);
          }
          if (q.includes('i.item_type = ?')) {
            const type = params[parameterIndex++];
            rows = rows.filter((row) => row.item_type === type);
          }
          if (q.includes('c.category_name = ?')) {
            const category = String(params[parameterIndex++]).toLowerCase();
            rows = rows.filter((row) => state.categories.find((entry) => Number(entry.category_id) === Number(row.category_id))?.category_name.toLowerCase() === category);
          }
          if (/\band i\.location like \?/.test(q)) {
            const location = params[parameterIndex++];
            rows = rows.filter((row) => like(row.location, location));
          }
          if (q.includes('(i.item_name like ?')) {
            const patterns = params.slice(parameterIndex, parameterIndex + 4);
            parameterIndex += 4;
            rows = rows.filter((row) => {
              const category = state.categories.find((entry) => Number(entry.category_id) === Number(row.category_id));
              return [row.item_name, row.description, row.location, category?.category_name].some((value, index) => like(value, patterns[index]));
            });
          }
          if (q.includes('i.item_date >= ?')) {
            const from = String(params[parameterIndex++]);
            rows = rows.filter((row) => String(row.item_date) >= from);
          }
          if (q.includes('i.item_date <= ?')) {
            const to = String(params[parameterIndex++]);
            rows = rows.filter((row) => String(row.item_date) <= to);
          }
        }
        if (q.includes('order by i.item_date asc')) rows.sort((a, b) => String(a.item_date).localeCompare(String(b.item_date)) || String(a.created_at).localeCompare(String(b.created_at)));
        else if (q.includes('order by i.item_date desc')) rows.sort((a, b) => String(b.item_date).localeCompare(String(a.item_date)) || String(b.created_at).localeCompare(String(a.created_at)));
        else if (q.includes('order by i.created_at desc')) rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        const limit = Number(params[params.length - 1]);
        if (Number.isFinite(limit) && limit > 0 && q.includes('limit ?')) rows = rows.slice(0, limit);
        return [rows.map((row) => {
          const category = state.categories.find((entry) => Number(entry.category_id) === Number(row.category_id));
          const user = state.users.find((entry) => Number(entry.user_id) === Number(row.user_id));
          return { id: row.item_id, ownerId: row.user_id, type: row.item_type, title: row.item_name, category: category?.category_name || 'Unknown', description: row.description, location: row.location, date: row.item_date, colour: row.colour, image: row.image_path, status: row.status, createdAt: row.created_at, updatedAt: row.created_at, reportedBy: user?.full_name || '' };
        })];
      }
      if (q.startsWith('select status from items where item_id = ?')) {
        const item = state.items.find((row) => Number(row.item_id) === Number(params[0]));
        return [item ? [{ status: item.status }] : []];
      }
      if (q.startsWith('select item_id, user_id, item_type, status from items where item_id = ?')) {
        const item = state.items.find((row) => Number(row.item_id) === Number(params[0]));
        return [item ? [{ item_id: item.item_id, user_id: item.user_id, item_type: item.item_type, status: item.status }] : []];
      }
      if (q.startsWith('insert into items')) {
        const [user_id, category_id, item_type, item_name, description, location, item_date, colour, image_path] = params;
        const item_id = state.nextItemId++;
        state.items.push({ item_id, user_id, category_id, item_type, item_name, description, location, item_date, colour, image_path, status: 'Pending review', created_at: new Date().toISOString() });
        return [{ insertId: item_id, affectedRows: 1 }];
      }
      if (q.startsWith('update items set status = ?')) {
        const [status, itemId, priorStatus] = params;
        const item = state.items.find((row) => Number(row.item_id) === Number(itemId) && (!priorStatus || row.status === priorStatus));
        if (!item) return [{ affectedRows: 0 }];
        item.status = status;
        return [{ affectedRows: 1 }];
      }

      if (q.startsWith('select claim_id from claims where item_id = ? and claimant_id = ?')) {
        const claim = state.claims.find((row) => Number(row.item_id) === Number(params[0]) && Number(row.claimant_id) === Number(params[1]));
        return [claim ? [{ claim_id: claim.claim_id }] : []];
      }
      if (q.startsWith('insert into claims')) {
        const [item_id, claimant_id, claim_description] = params;
        if (state.claims.some((row) => Number(row.item_id) === Number(item_id) && Number(row.claimant_id) === Number(claimant_id))) {
          const error = new Error('Duplicate claim'); error.code = 'ER_DUP_ENTRY'; throw error;
        }
        const claim_id = state.nextClaimId++;
        state.claims.push({ claim_id, item_id, claimant_id, claim_description, status: 'pending', created_at: new Date().toISOString() });
        return [{ insertId: claim_id, affectedRows: 1 }];
      }
      if (q.startsWith('select cl.claim_id as id')) {
        let rows = [...state.claims];
        if (q.includes('where cl.claimant_id = ?')) rows = rows.filter((row) => Number(row.claimant_id) === Number(params[0]));
        rows.sort((a, b) => b.claim_id - a.claim_id);
        return [rows.map((row) => {
          const item = state.items.find((entry) => Number(entry.item_id) === Number(row.item_id));
          const user = state.users.find((entry) => Number(entry.user_id) === Number(row.claimant_id));
          const category = state.categories.find((entry) => Number(entry.category_id) === Number(item?.category_id));
          return { id: row.claim_id, reportId: row.item_id, userId: row.claimant_id, explanation: row.claim_description, status: row.status, createdAt: row.created_at, itemTitle: item?.item_name, itemType: item?.item_type, itemStatus: item?.status, location: item?.location, category: category?.category_name, claimantName: user?.full_name };
        })];
      }
      if (q.startsWith("update claims set status = ? where claim_id = ? and status = 'pending'")) {
        const [status, claimId] = params;
        const claim = state.claims.find((row) => Number(row.claim_id) === Number(claimId) && row.status === 'pending');
        if (!claim) return [{ affectedRows: 0 }];
        claim.status = status;
        return [{ affectedRows: 1 }];
      }
      if (q.startsWith('select status from claims where claim_id = ?')) {
        const claim = state.claims.find((row) => Number(row.claim_id) === Number(params[0]));
        return [claim ? [{ status: claim.status }] : []];
      }

      if (q.startsWith('select count(*) as total') && q.includes('from items')) {
        return [[{ total: state.items.length, pending: state.items.filter((row) => row.status === 'Pending review').length, approved: state.items.filter((row) => row.status === 'Approved').length, rejected: state.items.filter((row) => row.status === 'Rejected').length, recovered: state.items.filter((row) => row.status === 'Recovered').length, lost: state.items.filter((row) => row.item_type === 'lost').length, found: state.items.filter((row) => row.item_type === 'found').length }]];
      }
      if (q.startsWith('select count(*) as total') && q.includes('from claims')) {
        return [[{ total: state.claims.length, pending: state.claims.filter((row) => row.status === 'pending').length, approved: state.claims.filter((row) => row.status === 'approved').length, rejected: state.claims.filter((row) => row.status === 'rejected').length }]];
      }
      if (q.startsWith('select c.category_name as label')) {
        return [[...state.categories].map((category) => ({ label: category.category_name, value: state.items.filter((item) => Number(item.category_id) === Number(category.category_id)).length }))];
      }

      throw new Error(`Unhandled test SQL: ${q.slice(0, 140)}`);
    },
    async query(sql, params) { return this.execute(sql, params); },
    async end() {},
  };
  return pool;
}

module.exports = { createMemoryPool };
