(() => {
  const {
    LEVEL_LABELS,
    createSkillTypeOptions,
    createIndices,
    escapeHtml,
    formatBaseMaterialsText,
    getLevelLabel,
    getMaterialNames,
    getPrimaryRecord,
    getSearchableText,
    getTeamMaterialGroups,
    readStoredArray,
    resolveRecordLabel,
    writeStoredArray
  } = window.ORDApp;

  function renderMaterialsList(level1Items, level0Items) {
    if (level1Items.length === 0 && level0Items.length === 0) {
      return '<span class="muted">無</span>';
    }

    let html = '';
    if (level1Items.length > 0) {
      html += `
        <div class="materials-group">
          <h4 class="materials-subgroup-title" style="margin: 4px 0 8px; font-size: 0.85rem; color: #ffd28a;">角色</h4>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${level1Items
              .map(
                (item) => `
                  <div class="materials-item">
                    <span>${escapeHtml(item.name)}</span>
                    <span class="item-qty">x${item.count}</span>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `;
    }
    if (level0Items.length > 0) {
      html += `
        <div class="materials-group" style="margin-top: 12px;">
          <h4 class="materials-subgroup-title" style="margin: 4px 0 8px; font-size: 0.85rem; color: #ffd28a;">特殊物品</h4>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${level0Items
              .map(
                (item) => `
                  <div class="materials-item">
                    <span>${escapeHtml(item.name)}</span>
                    <span class="item-qty">x${item.count}</span>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    return html;
  }

  function renderTeamSummaryMaterials(level1Items, level0Items) {
    if (level1Items.length === 0 && level0Items.length === 0) {
      return '<div class="muted">無需求材料</div>';
    }

    return [...level1Items, ...level0Items]
      .map(
        (item) => `
          <div class="team-summary-material-item" style="border-left: 3px solid ${item.level === 1 ? 'var(--primary-color)' : 'var(--muted-color)'};">
            <span class="name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
            <span class="qty">x${item.count}</span>
          </div>
        `
      )
      .join('');
  }

  function initCompPage(records) {
    const indices = createIndices(records);
    const compSearchInput = document.getElementById('compSearchInput');
    const levelCheckboxGroup = document.getElementById('levelCheckboxGroup');
    const skillTypeCheckboxGroup = document.getElementById('skillTypeCheckboxGroup');
    const compFiltersBody = document.getElementById('compFiltersBody');
    const compSummaryText = document.getElementById('compSummaryText');
    const compCharacterGroups = document.getElementById('compCharacterGroups');
    const selectedTeamList = document.getElementById('selectedTeamList');
    const teamMaterialsList = document.getElementById('teamMaterialsList');
    const analyzeTeamBtn = document.getElementById('analyzeTeamBtn');
    const clearTeamBtn = document.getElementById('clearTeamBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const toggleCompFiltersBtn = document.getElementById('toggleCompFiltersBtn');

    let selectedTeamIds = readStoredArray(localStorage, 'selectedTeamIds').filter((id) => indices.byCharacterId.has(id));
    let checkedLevels = new Set();
    let checkedSkillTypes = new Set();
    let searchKeyword = '';
    let areFiltersCollapsed = localStorage.getItem('compFiltersCollapsed') === 'true';

    function persistSelectedTeam() {
      writeStoredArray(localStorage, 'selectedTeamIds', selectedTeamIds);
    }

    function updateFilterCollapseUI() {
      compFiltersBody.classList.toggle('is-hidden', areFiltersCollapsed);
      toggleCompFiltersBtn.setAttribute('aria-expanded', String(!areFiltersCollapsed));
      toggleCompFiltersBtn.textContent = areFiltersCollapsed ? '展開條件' : '收合條件';
    }

    function renderLevelCheckboxes() {
      levelCheckboxGroup.innerHTML = '';
      const sortedLevels = Object.entries(LEVEL_LABELS)
        .map(([level, label]) => ({ level: Number(level), label }))
        .sort((left, right) => left.level - right.level);

      sortedLevels.forEach(({ level, label }) => {
        if(level > 3){ 
            const checkboxLabel = document.createElement('label');
            checkboxLabel.className = 'checkbox-badge';
            checkboxLabel.innerHTML = `
              <input type="checkbox" value="${level}" ${checkedLevels.has(level) ? 'checked' : ''}>
              <span class="checkbox-badge-label badge-${level}">${level}｜${label}</span>
            `;

            const input = checkboxLabel.querySelector('input');
            input.addEventListener('change', () => {
              if (input.checked) {
                checkedLevels.add(level);
              } else {
                checkedLevels.delete(level);
              }
              renderCharactersList();
            });
            levelCheckboxGroup.appendChild(checkboxLabel);
        }
      });
    }

    function renderSkillTypeCheckboxes() {
      skillTypeCheckboxGroup.innerHTML = createSkillTypeOptions()
        .map(
          ({ value, label }) => `
            <label class="checkbox-badge">
              <input type="checkbox" value="${escapeHtml(value)}" ${checkedSkillTypes.has(value) ? 'checked' : ''}>
              <span class="checkbox-badge-label">${escapeHtml(label)}</span>
            </label>
          `
        )
        .join('');

      skillTypeCheckboxGroup.querySelectorAll('input').forEach((input) => {
        input.addEventListener('change', () => {
          if (input.checked) {
            checkedSkillTypes.add(input.value);
          } else {
            checkedSkillTypes.delete(input.value);
          }
          renderCharactersList();
        });
      });
    }

    function renderTeamPanel() {
      if (selectedTeamIds.length === 0) {
        selectedTeamList.innerHTML = '<div class="empty-state">尚未選取任何角色。</div>';
      } else {
        selectedTeamList.innerHTML = selectedTeamIds
          .map((id) => {
            const record = indices.byCharacterId.get(id);
            if (!record) {
              return '';
            }

            return `
              <div class="team-member-card">
                <div class="team-member-info">
                  <span class="badge badge-${record.level}" style="min-width: unset; padding: 2px 8px; font-size: 0.75rem;">${getLevelLabel(record.level)}</span>
                  <span class="team-member-name">${escapeHtml(record.name)}</span>
                </div>
                <button class="team-member-remove" data-id="${escapeHtml(id)}" type="button" title="移出隊伍">&times;</button>
              </div>
            `;
          })
          .join('');

        selectedTeamList.querySelectorAll('.team-member-remove').forEach((button) => {
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            selectedTeamIds = selectedTeamIds.filter((id) => id !== button.dataset.id);
            persistSelectedTeam();
            renderTeamPanel();
            renderCharactersList();
          });
        });
      }

      const { level0Items, level1Items } = getTeamMaterialGroups(selectedTeamIds, indices);
      teamMaterialsList.innerHTML = renderMaterialsList(level1Items, level0Items);
    }

    function renderCharactersList() {
      const filteredRecords = indices.records.filter((record) => {
        if (checkedLevels.size > 0 && !checkedLevels.has(record.level)) {
          return false;
        }
        if (checkedSkillTypes.size > 0) {
          const recordSkillTypes = new Set((record.skill_types || []).map(String));
          const hasMatchedSkill = Array.from(checkedSkillTypes).some((skillType) => recordSkillTypes.has(skillType));
          if (!hasMatchedSkill) {
            return false;
          }
        }
        if (searchKeyword) {
          return getSearchableText(record, indices).includes(searchKeyword);
        }
        return true;
      });

      compSummaryText.textContent = `符合條件：${filteredRecords.length} / ${indices.records.length} 筆`;

      if (filteredRecords.length === 0) {
        compCharacterGroups.innerHTML = '<div class="empty-state">沒有符合條件的角色。</div>';
        return;
      }

      const groups = new Map();
      filteredRecords.forEach((record) => {
        if (!groups.has(record.level)) {
          groups.set(record.level, []);
        }
        groups.get(record.level).push(record);
      });

      const sortedLevels = (Array.from(groups.keys()).sort((left, right) => left - right)).filter(lv=> lv > 3);

      compCharacterGroups.innerHTML = sortedLevels
        .map((level) => {
          const groupRecords = groups.get(level);
          const levelLabel = getLevelLabel(level);

          const cardsHtml = groupRecords
            .map((record) => {
              const isSelected = selectedTeamIds.includes(record.character_id);
              const materialsText = record.materials && record.materials.length > 0
                ? record.materials.map((material) => resolveRecordLabel(material.material_id, indices)).join(' + ')
                : '無';

              return `
                <div class="char-card ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(record.character_id)}">
                  <div class="char-card-checkbox-wrapper">
                    <input type="checkbox" class="char-card-checkbox" ${isSelected ? 'checked' : ''} data-id="${escapeHtml(record.character_id)}">
                  </div>
                  <div class="char-card-content">
                    <div class="char-card-name-row">
                      <span class="char-card-name">${escapeHtml(record.name)}</span>
                      <span class="badge badge-${record.level}" style="min-width: unset; padding: 2px 8px; font-size: 0.72rem;">${escapeHtml(levelLabel)}</span>
                    </div>
                    <div class="char-card-materials" title="${escapeHtml(materialsText)}">
                      材料：${escapeHtml(materialsText)}
                    </div>
                    ${record.remark ? `<div class="char-card-remark">${escapeHtml(record.remark)}</div>` : ''}
                  </div>
                </div>
              `;
            })
            .join('');

          return `
            <section class="char-group-section">
              <div class="char-group-header">
                <h3 class="char-group-title">
                  <span class="badge badge-${level}" style="min-width: unset; padding: 4px 10px; font-size: 0.85rem;">${levelLabel}</span>
                </h3>
                <span class="char-group-count">${groupRecords.length} 個角色</span>
              </div>
              <div class="char-group-grid">
                ${cardsHtml}
              </div>
            </section>
          `;
        })
        .join('');

      compCharacterGroups.querySelectorAll('.char-card').forEach((card) => {
        const id = card.dataset.id;

        const toggleSelect = () => {
          const index = selectedTeamIds.indexOf(id);
          if (index > -1) {
            selectedTeamIds.splice(index, 1);
          } else {
            selectedTeamIds.push(id);
          }
          persistSelectedTeam();
          renderTeamPanel();

          const checkbox = card.querySelector('.char-card-checkbox');
          const isSelectedNow = selectedTeamIds.includes(id);
          card.classList.toggle('selected', isSelectedNow);
          if (checkbox) {
            checkbox.checked = isSelectedNow;
          }
        };

        card.addEventListener('click', (event) => {
          if (event.target.tagName === 'INPUT' || event.target.closest('.char-card-checkbox-wrapper')) {
            return;
          }
          toggleSelect();
        });

        const checkbox = card.querySelector('.char-card-checkbox');
        if (checkbox) {
          checkbox.addEventListener('change', toggleSelect);
        }
      });
    }

    compSearchInput.addEventListener('input', (event) => {
      searchKeyword = event.target.value.trim().toLowerCase();
      renderCharactersList();
    });

    resetFiltersBtn.addEventListener('click', () => {
      compSearchInput.value = '';
      searchKeyword = '';
      checkedLevels.clear();
      checkedSkillTypes.clear();
      levelCheckboxGroup.querySelectorAll('input').forEach((input) => {
        input.checked = false;
      });
      skillTypeCheckboxGroup.querySelectorAll('input').forEach((input) => {
        input.checked = false;
      });
      renderCharactersList();
    });

    toggleCompFiltersBtn.addEventListener('click', () => {
      areFiltersCollapsed = !areFiltersCollapsed;
      localStorage.setItem('compFiltersCollapsed', areFiltersCollapsed ? 'true' : 'false');
      updateFilterCollapseUI();
    });

    clearTeamBtn.addEventListener('click', () => {
      if (selectedTeamIds.length === 0) {
        return;
      }
      if (window.confirm('確定清空目前的隊伍嗎？')) {
        selectedTeamIds = [];
        persistSelectedTeam();
        renderTeamPanel();
        renderCharactersList();
      }
    });

    analyzeTeamBtn.addEventListener('click', () => {
      if (selectedTeamIds.length === 0) {
        window.alert('請先在角色庫中選取角色加入隊伍！');
        return;
      }
      writeStoredArray(sessionStorage, 'selectedTeamIds', selectedTeamIds);
      window.location.href = 'comp_tree.html';
    });

    renderLevelCheckboxes();
    renderSkillTypeCheckboxes();
    updateFilterCollapseUI();
    renderTeamPanel();
    renderCharactersList();
  }

  function initCompTreePage(records) {
    const indices = createIndices(records);
    const compTreeTabs = document.getElementById('compTreeTabs');
    const compTreeEmptyState = document.getElementById('compTreeEmptyState');
    const compTreeContent = document.getElementById('compTreeContent');
    const compTreeResultTitle = document.getElementById('compTreeResultTitle');
    const compTreeRootSummary = document.getElementById('compTreeRootSummary');
    const compDownwardContainer = document.getElementById('compDownwardContainer');
    const compToggleUpwardButton = document.getElementById('compToggleUpwardButton');
    const compUpwardContainer = document.getElementById('compUpwardContainer');
    const compTreeTeamMaterials = document.getElementById('compTreeTeamMaterials');

    let selectedTeamIds = readStoredArray(sessionStorage, 'selectedTeamIds').filter((id) => indices.byCharacterId.has(id));
    if (selectedTeamIds.length === 0) {
      compTreeEmptyState.classList.remove('is-hidden');
      compTreeContent.classList.add('is-hidden');
      return;
    }

    compTreeEmptyState.classList.add('is-hidden');
    compTreeContent.classList.remove('is-hidden');

    const { level0Items, level1Items } = getTeamMaterialGroups(selectedTeamIds, indices);
    let activeIndex = 0;

    function renderCompNodeCard(record, options = {}) {
      const titleMarkup = options.navigateable
        ? `<button type="button" class="tree-node-action" data-navigate-character="${escapeHtml(record.character_id)}">${escapeHtml(record.name)}</button>`
        : `<strong>${escapeHtml(record.name)}</strong>`;

      return `
        <div class="node-card ${record.level === 0 ? 'placeholder' : ''}">
          <div class="node-title">
            <span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span>
            ${titleMarkup}
            ${record.key_code ? `(${record.key_code})` : ''}
          </div>
          <div class="node-detail">
            <div>材料：${escapeHtml(getMaterialNames(record, indices).join('、') || '無')}</div>
          </div>
        </div>
      `;
    }

    function renderMissingNodeCard(characterId) {
      return `<li><div class="node-card placeholder"><div class="node-title"><strong>${escapeHtml(characterId)}</strong></div><div class="node-detail">查無對應資料</div></div></li>`;
    }

    function renderCompDownwardBranch(record, trailCharacterIds) {
      const nextTrail = new Set(trailCharacterIds);
      nextTrail.add(record.character_id);
      const materials = record.materials || [];

      if (materials.length === 0) {
        return `<li>${renderCompNodeCard(record)}</li>`;
      }

      const childrenMarkup = materials
        .map((material) => {
          const childRecord = getPrimaryRecord(material.material_id, indices);
          if (!childRecord) {
            return renderMissingNodeCard(material.material_id);
          }

          if (nextTrail.has(childRecord.character_id)) {
            return `<li>
              ${renderCompNodeCard(childRecord)}
              <div class="status-line">此節點與上層屬於同一角色 ID，已停止繼續展開避免循環。</div>
            </li>`;
          }

          return renderCompDownwardBranch(childRecord, nextTrail);
        })
        .join('');

      return `
        <li>
          <details class="branch-details">
            <summary class="branch-summary">
              ${renderCompNodeCard(record, { navigateable: true })}
              <span class="branch-toggle-hint">
                <img style="vertical-align: middle" width="25" height="25" src="resource/arrow_drop_down.svg" alt="點擊收合 / 展開">
              </span>
            </summary>
            <ul class="tree-list">${childrenMarkup}</ul>
          </details>
        </li>
      `;
    }

    function renderCompUpwardSection(record) {
      const parents = indices.parentMap.get(record.character_id) || [];

      if (parents.length === 0) {
        compToggleUpwardButton.textContent = '此角色沒有上層';
        compToggleUpwardButton.disabled = true;
        compUpwardContainer.innerHTML = '<div class="empty-state">無上層角色</div>';
        return;
      }

      compToggleUpwardButton.disabled = false;
      compToggleUpwardButton.textContent = `顯示上層（${parents.length} 筆）`;
      compUpwardContainer.innerHTML = `
        <div class="upward-card">
          <h3><span>上層角色</span></h3>
          <ul class="upward-list">
            ${parents.map((parent) => `<li>${renderCompNodeCard(parent, { navigateable: true })}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    function renderCompTree(record) {
      compTreeResultTitle.textContent = `${record.name}｜${getLevelLabel(record.level)} | KR: ${escapeHtml(record.kr_name || '')} | EN: ${escapeHtml(record.en_name || '')}`;

      compTreeRootSummary.innerHTML = `
        <div class="tree-card" style="margin-bottom: 12px;">
          <div class="node-card ${record.level === 0 ? 'placeholder' : ''}">
            <div class="node-title">
              <span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span>
              ${record.name} ${record.key_code ? `(${record.key_code})` : ''}
            </div>
            <div class="node-detail">
              <div>備註：${escapeHtml(record.remark || '無')}</div>
              <div>總材料：${escapeHtml(formatBaseMaterialsText(record, indices))}</div>
            </div>
          </div>
        </div>
      `;

      const directMaterials = record.materials || [];
      compDownwardContainer.innerHTML = `
        <div class="tree-card">
          ${directMaterials.length === 0
            ? '<div class="empty-state">這個角色沒有可往下的材料。</div>'
            : `<ul class="tree-list">${directMaterials
                .map((material) => {
                  const childRecord = getPrimaryRecord(material.material_id, indices);
                  if (!childRecord) {
                    return renderMissingNodeCard(material.material_id);
                  }

                  return renderCompDownwardBranch(childRecord, new Set([record.character_id]));
                })
                .join('')}</ul>`}
        </div>
      `;

      if (compUpwardContainer && compToggleUpwardButton) {
        renderCompUpwardSection(record);
      }
    }

    function renderTabs() {
      compTreeTabs.innerHTML = selectedTeamIds
        .map((id, index) => {
          const record = indices.byCharacterId.get(id);
          if (!record) {
            return '';
          }

          return `
            <button type="button" class="comp-tree-tab-btn ${index === activeIndex ? 'active' : ''}" data-index="${index}">
              <span class="badge badge-${record.level}" style="min-width: unset; padding: 2px 6px; font-size: 0.72rem;">${getLevelLabel(record.level)}</span>
              <span>${escapeHtml(record.name)}</span>
            </button>
          `;
        })
        .join('');

      compTreeTabs.querySelectorAll('.comp-tree-tab-btn').forEach((button) => {
        button.addEventListener('click', () => {
          activeIndex = Number(button.dataset.index);
          renderTabs();

          if (compUpwardContainer) {
            compUpwardContainer.classList.add('is-hidden');
          }

          const activeRecord = indices.byCharacterId.get(selectedTeamIds[activeIndex]);
          if (activeRecord) {
            renderCompTree(activeRecord);
          }
        });
      });
    }

    function handleCompTreeNavigation(event) {
      const target = event.target.closest('[data-navigate-character]');
      if (!target) {
        return;
      }

      const record = indices.byCharacterId.get(target.dataset.navigateCharacter);
      if (!record) {
        return;
      }

      renderCompTree(record);
      compDownwardContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (compUpwardContainer) {
      compUpwardContainer.addEventListener('click', handleCompTreeNavigation);
    }
    compDownwardContainer.addEventListener('click', handleCompTreeNavigation);

    if (compToggleUpwardButton && compUpwardContainer) {
      compToggleUpwardButton.addEventListener('click', () => {
        compUpwardContainer.classList.toggle('is-hidden');
        compToggleUpwardButton.textContent = compUpwardContainer.classList.contains('is-hidden')
          ? compToggleUpwardButton.textContent.replace('隱藏', '顯示')
          : compToggleUpwardButton.textContent.replace('顯示', '隱藏');
      });
    }

    renderTabs();
    compTreeTeamMaterials.innerHTML = renderTeamSummaryMaterials(level1Items, level0Items);
    const firstRecord = indices.byCharacterId.get(selectedTeamIds[0]);
    if (firstRecord) {
      renderCompTree(firstRecord);
    }
  }

  window.ORDApp.initCompPage = initCompPage;
  window.ORDApp.initCompTreePage = initCompTreePage;
})();
