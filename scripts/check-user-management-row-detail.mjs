import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

function requireMatch(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const renderStart = app.indexOf('function renderUsersTable()');
const renderEnd = app.indexOf('function applyUsersFiltersLocal()', renderStart);
const renderBlock = app.slice(renderStart, renderEnd);
const usersPageStart = index.indexOf('<!-- ==================== USERS PAGE (ADMIN) ==================== -->');
const usersPageEnd = index.indexOf('<!-- ==================== TRANSAKSI PAGE ==================== -->', usersPageStart);
const usersPage = index.slice(usersPageStart, usersPageEnd);

requireMatch(renderStart >= 0 && renderEnd > renderStart, 'renderUsersTable must exist');
requireMatch(renderBlock.includes('class="user-row-clickable"'), 'user table rows must be clickable');
requireMatch(renderBlock.includes('onclick="openUserDetailModal('), 'row click must open user detail');
requireMatch(renderBlock.includes('onkeydown="handleUserRowKeydown('), 'row must support keyboard access');
requireMatch(!renderBlock.includes('action-btn edit'), 'edit icon must be removed from user rows');
requireMatch(!renderBlock.includes('action-btn delete'), 'delete icon must be removed from user rows');
requireMatch(!usersPage.includes('>Aksi</th>'), 'users table must not include an action column');
requireMatch(index.includes('id="modalUserDetail"'), 'user detail modal must exist');
requireMatch(index.includes('onclick="editUserFromDetail()"'), 'edit action must be in detail modal');
requireMatch(index.includes('onclick="deleteUserFromDetail()"'), 'delete action must be in detail modal');
requireMatch(app.includes('function openUserDetailModal(rowNum)'), 'detail modal controller must exist');
requireMatch(app.includes('function editUserFromDetail()'), 'detail edit controller must exist');
requireMatch(app.includes('function deleteUserFromDetail()'), 'detail delete controller must exist');
requireMatch(index.includes('user-management-row-detail-styles'), 'responsive detail layout styles must exist');

if (!process.exitCode) console.log('User management row detail check passed.');
