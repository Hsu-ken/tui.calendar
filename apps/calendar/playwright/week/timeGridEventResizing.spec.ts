import { expect, Page, test } from '@playwright/test';

import type { FormattedTimeString } from '../../types/time/datetime';
import { WEEK_VIEW_PAGE_URL } from '../configs';
import { dragAndDrop, getBoundingBox, getTimeGridLineLocator } from '../utils';

test.beforeEach(async ({ page }) => {
  await page.goto(WEEK_VIEW_PAGE_URL);
});

const TARGET_EVENTS = {
  SHORT: {
    title: 'short time event', // 04:00 ~ 06:00, 4th row
    columnIndex: 3,
  },
  LONG: {
    title: 'long time event', // 10:00 ~ 6:00, 6 ~ 7th rows
    columnIndex: 5,
  },
  TWO_VIEWS: {
    title: 'two-view event', // 10:00 ~ 6:00, previous view ~ 1st row
    columnIndex: 0,
  },
};

const cases: {
  title: string;
  targetEndTime: FormattedTimeString;
  targetColumnIndex?: number;
  matcherToCompare: Extract<keyof jest.Matchers<number>, 'toBeGreaterThan' | 'toBeLessThan'>;
}[] = [
  {
    title: 'to the bottom',
    targetEndTime: '08:00',
    matcherToCompare: 'toBeGreaterThan',
  },
  {
    title: 'to the top',
    targetEndTime: '04:00',
    matcherToCompare: 'toBeLessThan',
  },
  {
    title: 'up to the y of the cursor when the target column is to the right of the current column',
    targetEndTime: '08:00',
    targetColumnIndex: 5,
    matcherToCompare: 'toBeGreaterThan',
  },
  {
    title: 'up to the y of the cursor when the target column is to the left of the current column',
    targetEndTime: '04:00',
    targetColumnIndex: 0,
    matcherToCompare: 'toBeLessThan',
  },
];

async function setup({
  page,
  targetEventTitle = TARGET_EVENTS.SHORT.title,
  targetEndTime,
  targetColumnIndex = TARGET_EVENTS.SHORT.columnIndex,
}: {
  page: Page;
  targetEventTitle: string;
  targetEndTime: FormattedTimeString;
  targetColumnIndex: number;
}) {
  // Given
  const targetEventSelector = `[data-testid*="time-event-${targetEventTitle}"]`;
  const eventLocator = page.locator(targetEventSelector).last();
  const resizeHandlerLocator = eventLocator.locator('[class*="resize-handler"]');
  const targetRowLocator = page.locator(getTimeGridLineLocator(targetEndTime));
  const targetColumnLocator = page.locator(`data-testid=timegrid-column-${targetColumnIndex}`);
  const eventBoundingBoxBeforeResize = await getBoundingBox(eventLocator);

  const targetRowBoundingBox = await getBoundingBox(targetRowLocator);
  const targetColumnBoundingBox = await getBoundingBox(targetColumnLocator);

  // When
  await dragAndDrop(resizeHandlerLocator, targetRowLocator, {
    sourcePosition: {
      x: 1,
      y: 1,
    },
    targetPosition: {
      x: targetColumnBoundingBox.x + 1,
      y: targetRowBoundingBox.height / 2,
    },
  });

  const eventBoundingBoxAfterResize = await getBoundingBox(eventLocator);

  return { eventBoundingBoxBeforeResize, eventBoundingBoxAfterResize, targetRowBoundingBox };
}

Object.values(TARGET_EVENTS).forEach(({ title: eventTitle, columnIndex }) => {
  test.describe(`Resize a ${eventTitle} in the time grid`, () => {
    cases.forEach(
      ({ title, targetEndTime, targetColumnIndex, matcherToCompare: compareAssertion }) => {
        test(`${title}`, async ({ page }) => {
          const {
            eventBoundingBoxBeforeResize,
            eventBoundingBoxAfterResize,
            targetRowBoundingBox,
          } = await setup({
            page,
            targetEventTitle: eventTitle,
            targetEndTime,
            targetColumnIndex: targetColumnIndex || columnIndex,
          });

          // Then
          expect(eventBoundingBoxAfterResize.height)[compareAssertion](
            eventBoundingBoxBeforeResize.height
          );

          expect(eventBoundingBoxAfterResize.y + eventBoundingBoxAfterResize.height).toBeCloseTo(
            targetRowBoundingBox.y + targetRowBoundingBox.height,
            -1
          );
        });
      }
    );

    test(`then it should have a minimum height(=1 row) even if the event is resized to before the start time`, async ({
      page,
    }) => {
      const { eventBoundingBoxAfterResize, targetRowBoundingBox } = await setup({
        page,
        targetEventTitle: eventTitle,
        targetEndTime: '00:00',
        targetColumnIndex: columnIndex,
      });

      // Then
      expect(eventBoundingBoxAfterResize.height).toBeCloseTo(targetRowBoundingBox.height, -1);
    });
  });
});
